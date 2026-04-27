import * as THREE from "three";
import { getLocalizedNameText } from "../constants.js";
import {
  triggerBlobDownload,
  triggerDownload,
  triggerNamedBlobDownload,
  triggerNamedDownload,
} from "../io/exporters.js";
import { t } from "../i18n.js";
import { serializeTwinParameters } from "../domain/parameters.js";
import { twinPlaneNormal } from "../domain/crystalFrame.js";
import { splitBufferGeometryByPlaneWithJscad } from "../domain/jscadCsg.js";
import {
  createTwinPreviewSettingsDocument,
  type TwinPreviewStyleSettings,
} from "../preview/previewStyleSettings.js";
import type { TwinStlSplitSettings } from "../state/stlSplitSettings.js";

/**
 * export 実行を `main.ts` から切り離すための action 群。
 *
 * export の本体は state といくつかの builder に依存するだけなので、
 * UI event 配線から分離しても挙動を変えにくい部分として先に外へ逃がす。
 *
 * 主に扱う日本語文言:
 * - SVG の書き出しに失敗しました: ...
 * - PNG の書き出しに失敗しました: ...
 * - JPEG の書き出しに失敗しました: ...
 */

interface TwinExportParametersLike {
  name: { en: string; jp: string };
  crystalSystem: string;
  axes: Record<string, number>;
  angles: Record<string, number>;
  faces: Record<string, unknown>[];
  twin?: {
    crystals?: {
      enabled?: boolean;
      faces?: {
        text?: {
          content?: string | null;
        } | null;
      }[];
    }[];
  };
  [key: string]: unknown;
}

/** export action が参照する最小限の state。 */
interface TwinExportStateLike {
  parameters: TwinExportParametersLike;
  stlSplit: TwinStlSplitSettings;
  buildResult: TwinBuildResultLike | null;
  faceDisplayMode: string;
  previewRoot: THREE.Object3D | null;
  previewStyleSettings: TwinPreviewStyleSettings;
}

/** 双晶 build 結果のうち export action が参照する部分集合。 */
interface TwinBuildResultLike {
  finalGeometry: THREE.BufferGeometry | null;
  previewFinalGeometry: THREE.BufferGeometry | null;
  crystalPreviewGeometries: (THREE.BufferGeometry | null)[];
  crystalStlCompositeGeometries?: (THREE.BufferGeometry | null)[] | null;
}

interface TwinStlSourceSelection {
  selectedSource:
    | "union-final-geometry"
    | "merged-crystal-preview-geometries"
    | "composited-crystal-stl-geometries";
  unionScore: number;
  fallbackScore: number | null;
  compositeScore: number | null;
  preferTextPreservingFallback: boolean;
  textPreservingFallbackStrategy:
    | "merged-crystal-preview-geometries"
    | "composited-crystal-stl-geometries";
}

type TwinStlModule = typeof import("../io/formats/stl.js");
type TwinPreviewSvgExportResult =
  | string
  | {
      svgMarkup: string;
      debugLog?: unknown;
    };

let twinStlModulePromise: Promise<TwinStlModule> | null = null;

/** STL export は保存時だけ必要なので、初回利用時にだけ遅延読込する。 */
function loadTwinStlModule() {
  twinStlModulePromise ??= import("../io/formats/stl.js");
  return twinStlModulePromise;
}

/** 双晶 export action に外から渡す依存関係。 */
export interface TwinExportActionsContext {
  state: TwinExportStateLike;
  getVisibleCrystalIndexes: () => number[];
  buildPreviewExportSvg: (options?: {
    includeDebug?: boolean;
  }) => TwinPreviewSvgExportResult;
  buildPreviewRasterBackedSvg: () => string;
  buildPreviewPngBlob: () => Promise<Blob>;
  buildPreviewJpegBlob: () => Promise<Blob>;
  shouldUseVectorCrystalBodyForSvgExport: () => boolean;
  alert: (message: string) => void;
}

/**
 * export action 群を返す。
 *
 * `state` は参照で保持し、実行時点の最新内容を使う。戻り値の各関数は download を
 * 発火する副作用を持つ。
 */
export function createTwinExportActions(context: TwinExportActionsContext) {
  /** export 時のベースファイル名を、現在言語名と preset 名から決める。 */
  function getExportBaseFilename(fallbackBaseName: string) {
    const rawName = getLocalizedNameText(
      context.state.parameters.name,
      "jp",
    ).trim();
    const sanitized = rawName
      // eslint-disable-next-line no-control-regex -- Windows 禁止文字と ASCII 制御文字を同時に除去するため
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
      .replace(/\s+/g, " ")
      .replace(/[. ]+$/g, "")
      .trim();
    return sanitized || fallbackBaseName;
  }

  /** geometry の最大寸法だけを返す。STL fallback のスケール合わせに使う。 */
  function getGeometryMaxDimension(geometry: THREE.BufferGeometry | null) {
    if (!geometry) {
      return 0;
    }
    geometry.computeBoundingBox();
    const size = geometry.boundingBox?.getSize(new THREE.Vector3());
    if (!size) {
      return 0;
    }
    return Math.max(size.x, size.y, size.z, 0);
  }

  /** 複数の geometry を STL 出力用の単一 triangle soup にまとめる。 */
  function mergeGeometriesForStlExport(
    geometries: (THREE.BufferGeometry | null)[],
  ) {
    const mergedPositions: number[] = [];
    geometries.filter(Boolean).forEach((geometry) => {
      if (!geometry) {
        return;
      }
      const source = geometry.index
        ? geometry.toNonIndexed()
        : geometry.clone();
      const positionAttribute = source.getAttribute("position");
      if (!positionAttribute) {
        return;
      }
      mergedPositions.push(...positionAttribute.array);
    });

    if (mergedPositions.length === 0) {
      return null;
    }

    const mergedGeometry = new THREE.BufferGeometry();
    mergedGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(mergedPositions, 3),
    );
    mergedGeometry.computeVertexNormals();
    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();
    return mergedGeometry;
  }

  function fillOpenEdgeLoops(
    geometry: THREE.BufferGeometry | null,
  ): THREE.BufferGeometry | null {
    if (!geometry) {
      return null;
    }

    const indexed = geometry.index ? geometry.clone() : geometry.clone();
    if (!indexed.index) {
      indexed.setIndex(
        Array.from(
          { length: indexed.getAttribute("position")?.count ?? 0 },
          (_, index) => index,
        ),
      );
    }

    const positionAttribute = indexed.getAttribute("position");
    const indexAttribute = indexed.getIndex();
    if (!positionAttribute || !indexAttribute) {
      return geometry;
    }

    const buildEdgeKey = (a: number, b: number) =>
      a < b ? `${a}:${b}` : `${b}:${a}`;
    const edgeOwners = new Map<
      string,
      { from: number; to: number; triangleIndex: number }[]
    >();

    for (let index = 0; index < indexAttribute.count; index += 3) {
      const triangleIndex = index / 3;
      const triangle = [
        indexAttribute.getX(index),
        indexAttribute.getX(index + 1),
        indexAttribute.getX(index + 2),
      ] as const;
      const edges = [
        [triangle[0], triangle[1]],
        [triangle[1], triangle[2]],
        [triangle[2], triangle[0]],
      ] as const;
      edges.forEach(([from, to]) => {
        const key = buildEdgeKey(from, to);
        const owners = edgeOwners.get(key) ?? [];
        owners.push({ from, to, triangleIndex });
        edgeOwners.set(key, owners);
      });
    }

    const adjacency = new Map<number, Set<number>>();
    const unusedEdges = new Set<string>();
    const edgeVertices = new Map<string, [number, number]>();

    [...edgeOwners.entries()]
      .filter(([, owners]) => owners.length === 1)
      .forEach(([edgeKey, owners]) => {
        const owner = owners[0];
        const a = owner.from;
        const b = owner.to;
        adjacency.set(a, adjacency.get(a) ?? new Set());
        adjacency.set(b, adjacency.get(b) ?? new Set());
        adjacency.get(a)?.add(b);
        adjacency.get(b)?.add(a);
        unusedEdges.add(edgeKey);
        edgeVertices.set(edgeKey, [a, b]);
      });

    const loops: number[][] = [];
    while (unusedEdges.size > 0) {
      const edgeKey = unusedEdges.values().next().value as string;
      const [start, next] = edgeVertices.get(edgeKey)!;
      unusedEdges.delete(edgeKey);
      const loop = [start];
      let previous = start;
      let current = next;

      while (current !== start) {
        loop.push(current);
        const neighbors = [...(adjacency.get(current) ?? [])];
        const candidate = neighbors.find((neighbor) => {
          if (neighbor === previous) {
            return false;
          }
          return unusedEdges.has(buildEdgeKey(current, neighbor));
        });
        if (candidate == null) {
          break;
        }
        unusedEdges.delete(buildEdgeKey(current, candidate));
        previous = current;
        current = candidate;
      }

      if (current === start && loop.length >= 3) {
        loops.push(loop);
      }
    }

    if (loops.length === 0) {
      return geometry;
    }

    const positions = Array.from(positionAttribute.array as ArrayLike<number>);
    const vectorA = new THREE.Vector3();
    const vectorB = new THREE.Vector3();
    const vectorC = new THREE.Vector3();

    loops.forEach((loop) => {
      const vertices = loop.map((vertexIndex) =>
        new THREE.Vector3().fromBufferAttribute(positionAttribute, vertexIndex),
      );
      vectorA.copy(vertices[1]).sub(vertices[0]);
      vectorB.copy(vertices[2]).sub(vertices[0]);
      const normal = vectorC.crossVectors(vectorA, vectorB).normalize();
      const reference =
        Math.abs(normal.x) < 0.9
          ? new THREE.Vector3(1, 0, 0)
          : new THREE.Vector3(0, 1, 0);
      const tangent = new THREE.Vector3()
        .crossVectors(reference, normal)
        .normalize();
      const bitangent = new THREE.Vector3()
        .crossVectors(normal, tangent)
        .normalize();
      const origin = vertices[0];
      let contour = vertices.map((vertex) => {
        const relative = vertex.clone().sub(origin);
        return new THREE.Vector2(
          relative.dot(tangent),
          relative.dot(bitangent),
        );
      });
      let sourceVertices = [...vertices];
      if (!THREE.ShapeUtils.isClockWise(contour)) {
        contour = [...contour].reverse();
        sourceVertices = [...sourceVertices].reverse();
      }
      const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
      triangles.forEach(([aIndex, bIndex, cIndex]) => {
        const triangle = [
          sourceVertices[aIndex],
          sourceVertices[bIndex],
          sourceVertices[cIndex],
        ];
        const triangleNormal = new THREE.Vector3()
          .subVectors(triangle[1], triangle[0])
          .cross(new THREE.Vector3().subVectors(triangle[2], triangle[0]));
        if (triangleNormal.dot(normal) < 0) {
          [triangle[1], triangle[2]] = [triangle[2], triangle[1]];
        }
        triangle.forEach((vertex) => {
          positions.push(vertex.x, vertex.y, vertex.z);
        });
      });
    });

    const patched = new THREE.BufferGeometry();
    patched.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    patched.computeVertexNormals();
    patched.computeBoundingBox();
    patched.computeBoundingSphere();
    return patched;
  }

  /** geometry の中心点を返す。切断平面の基準点に使う。 */
  function getGeometryCenter(geometry: THREE.BufferGeometry | null) {
    if (!geometry) {
      return null;
    }
    geometry.computeBoundingBox();
    return geometry.boundingBox?.getCenter(new THREE.Vector3()) ?? null;
  }

  /** preview geometry を final STL と同じ尺度へ変換した clone を返す。 */
  function scaleGeometryForStlExport(
    geometry: THREE.BufferGeometry | null,
    scaleFactor: number,
  ) {
    if (!geometry) {
      return null;
    }
    const clone = geometry.clone();
    clone.scale(scaleFactor, scaleFactor, scaleFactor);
    clone.computeVertexNormals();
    clone.computeBoundingBox();
    clone.computeBoundingSphere();
    return clone;
  }

  /** preview geometry 尺度から final STL 尺度への倍率を返す。 */
  function getPreviewToFinalScaleFactor(
    buildResult: NonNullable<TwinExportStateLike["buildResult"]>,
  ) {
    const previewMaxDimension = getGeometryMaxDimension(
      buildResult.previewFinalGeometry,
    );
    const finalMaxDimension = getGeometryMaxDimension(
      buildResult.finalGeometry,
    );
    return previewMaxDimension > 0
      ? finalMaxDimension / previewMaxDimension
      : 1;
  }

  /** 分割 STL 用に、可視結晶の geometry と基準となる結晶1 geometry を返す。 */
  function buildVisibleCrystalSplitGeometries(
    buildResult: NonNullable<TwinExportStateLike["buildResult"]>,
  ) {
    const visibleIndexes = context.getVisibleCrystalIndexes();
    const scaleFactor = getPreviewToFinalScaleFactor(buildResult);
    const sourceGeometries = buildResult.crystalStlCompositeGeometries?.length
      ? buildResult.crystalStlCompositeGeometries
      : buildResult.crystalPreviewGeometries;

    const geometries = visibleIndexes
      .map((index) => ({
        index,
        geometry: scaleGeometryForStlExport(
          sourceGeometries?.[index] ??
            buildResult.crystalPreviewGeometries?.[index] ??
            null,
          scaleFactor,
        ),
      }))
      .filter(
        (entry): entry is { index: number; geometry: THREE.BufferGeometry } =>
          Boolean(entry.geometry),
      );

    return {
      scaleFactor,
      visibleIndexes,
      geometries,
      crystalOneGeometry: scaleGeometryForStlExport(
        sourceGeometries?.[0] ??
          buildResult.crystalPreviewGeometries?.[0] ??
          null,
        scaleFactor,
      ),
    };
  }

  /** STL debug の topology を比較しやすい単一 score に潰す。 */
  function scoreStlTopology(debugLog: unknown) {
    if (!debugLog || typeof debugLog !== "object") {
      return Number.POSITIVE_INFINITY;
    }
    const topology = (debugLog as { topologyAfterOrientation?: unknown })
      .topologyAfterOrientation;
    if (
      !topology ||
      typeof topology !== "object" ||
      typeof (topology as { openEdgeCount?: unknown }).openEdgeCount !==
        "number" ||
      typeof (topology as { multiOwnerEdgeCount?: unknown })
        .multiOwnerEdgeCount !== "number"
    ) {
      return Number.POSITIVE_INFINITY;
    }
    return (
      (topology as { openEdgeCount: number }).openEdgeCount * 1000 +
      (topology as { multiOwnerEdgeCount: number }).multiOwnerEdgeCount
    );
  }

  /** active crystal に face text を持つ twin かを返す。 */
  function hasActiveCrystalsWithFaceText() {
    const crystals = context.state.parameters.twin?.crystals ?? [];
    const activeCrystals = crystals.filter(
      (crystal, index) => index === 0 || crystal?.enabled !== false,
    );
    return activeCrystals.some((crystal) =>
      (crystal.faces ?? []).some(
        (face) => String(face?.text?.content ?? "").trim().length > 0,
      ),
    );
  }

  function selectTwinStlSource({
    unionScore,
    fallbackScore,
    compositeScore,
    hasActiveFaceText,
    activeCrystalCount,
  }: {
    unionScore: number;
    fallbackScore: number | null;
    compositeScore: number | null;
    hasActiveFaceText: boolean;
    activeCrystalCount: number;
  }): TwinStlSourceSelection {
    const normalizedFallbackScore = fallbackScore ?? Number.POSITIVE_INFINITY;
    const preferredTextSource =
      compositeScore !== null && compositeScore < normalizedFallbackScore
        ? "composited-crystal-stl-geometries"
        : "merged-crystal-preview-geometries";
    const shouldPreferTextPreservingFallback =
      hasActiveFaceText && activeCrystalCount > 1;
    const shouldCompareSingleCrystalComposite =
      hasActiveFaceText && activeCrystalCount <= 1 && compositeScore !== null;
    const selectedSource = shouldPreferTextPreservingFallback
      ? preferredTextSource
      : shouldCompareSingleCrystalComposite && compositeScore! < unionScore
        ? "composited-crystal-stl-geometries"
        : normalizedFallbackScore < unionScore
          ? "merged-crystal-preview-geometries"
          : "union-final-geometry";

    return {
      selectedSource,
      unionScore,
      fallbackScore,
      compositeScore,
      preferTextPreservingFallback:
        shouldPreferTextPreservingFallback ||
        shouldCompareSingleCrystalComposite,
      textPreservingFallbackStrategy: preferredTextSource,
    };
  }

  /** SVG export は本体 markup だけを保存対象にする。 */
  function getPreviewSvgMarkup(result: TwinPreviewSvgExportResult) {
    return typeof result === "string" ? result : result.svgMarkup;
  }

  /**
   * 双晶 STL 用に、union geometry と「個別結晶 merge」の両候補からより閉じた方を選ぶ。
   *
   * 貫入双晶では CSG 結果が開放辺を多く含むことがあり、その場合は個別結晶の閉じた shell を
   * まとめた STL の方が穴を避けやすい。preview 見た目は変えず STL だけの fallback とする。
   */
  async function buildTwinStlArtifact(
    buildResult: NonNullable<TwinExportStateLike["buildResult"]>,
  ) {
    const stlModule = await loadTwinStlModule();
    const unionArtifact = stlModule.buildStlExportArtifact(
      buildResult.finalGeometry,
    );
    const unionScore = scoreStlTopology(unionArtifact.debug);

    const scaleFactor = getPreviewToFinalScaleFactor(buildResult);
    const scaledPreviewGeometries = (
      buildResult.crystalPreviewGeometries ?? []
    ).map((geometry) => {
      if (!geometry) {
        return null;
      }
      const clone = geometry.clone();
      clone.scale(scaleFactor, scaleFactor, scaleFactor);
      clone.computeVertexNormals();
      clone.computeBoundingBox();
      clone.computeBoundingSphere();
      return clone;
    });
    const activeCrystalCount =
      context.state.parameters.twin?.crystals?.filter(
        (crystal, index) => index === 0 || crystal?.enabled !== false,
      ).length ?? 1;
    const hasActiveFaceText = hasActiveCrystalsWithFaceText();
    const fallbackGeometry = mergeGeometriesForStlExport(
      scaledPreviewGeometries,
    );

    if (!fallbackGeometry) {
      return {
        ...unionArtifact,
        debug: {
          ...unionArtifact.debug,
          selectedSource: "union-final-geometry",
          unionCandidate: unionArtifact.debug,
          fallbackCandidate: null,
        },
      };
    }

    const fallbackArtifact = stlModule.buildStlExportArtifact(fallbackGeometry);
    const fallbackScore = scoreStlTopology(fallbackArtifact.debug);
    const compositeFallbackGeometry = mergeGeometriesForStlExport(
      (buildResult.crystalStlCompositeGeometries ?? []).map((geometry) => {
        if (!geometry) {
          return null;
        }
        const clone = geometry.clone();
        clone.scale(scaleFactor, scaleFactor, scaleFactor);
        clone.computeVertexNormals();
        clone.computeBoundingBox();
        clone.computeBoundingSphere();
        return clone;
      }),
    );
    const compositeArtifact = compositeFallbackGeometry
      ? stlModule.buildStlExportArtifact(compositeFallbackGeometry)
      : null;
    const compositeScore = compositeArtifact
      ? scoreStlTopology(compositeArtifact.debug)
      : null;
    const selection = selectTwinStlSource({
      unionScore,
      fallbackScore,
      compositeScore,
      hasActiveFaceText,
      activeCrystalCount,
    });
    const selectedArtifact =
      selection.selectedSource === "composited-crystal-stl-geometries"
        ? compositeArtifact!
        : selection.selectedSource === "merged-crystal-preview-geometries"
          ? fallbackArtifact
          : unionArtifact;

    return {
      ...selectedArtifact,
      debug: {
        ...selectedArtifact.debug,
        selectedSource: selection.selectedSource,
        unionCandidate: unionArtifact.debug,
        fallbackCandidate: fallbackArtifact.debug,
        compositeCandidate: compositeArtifact?.debug ?? null,
        unionScore: selection.unionScore,
        fallbackScore: selection.fallbackScore,
        compositeScore: selection.compositeScore,
        previewToFinalScaleFactor: scaleFactor,
        preferTextPreservingFallback: selection.preferTextPreservingFallback,
        textPreservingFallbackStrategy:
          selection.textPreservingFallbackStrategy,
        textPreservingUnionErrorMessage: null,
      },
    };
  }

  async function buildSplitTwinStlArtifact(
    buildResult: NonNullable<TwinExportStateLike["buildResult"]>,
  ) {
    const splitSource = buildVisibleCrystalSplitGeometries(buildResult);
    const crystalOneCenter = getGeometryCenter(splitSource.crystalOneGeometry);
    if (!crystalOneCenter || !buildResult.finalGeometry) {
      return null;
    }

    const stlModule = await loadTwinStlModule();
    const activeCrystalCount =
      context.state.parameters.twin?.crystals?.filter(
        (crystal, index) => index === 0 || crystal?.enabled !== false,
      ).length ?? 1;
    const hasActiveFaceText = hasActiveCrystalsWithFaceText();
    const unionPrepared = stlModule.prepareGeometryForStlExport(
      buildResult.finalGeometry,
    );
    const fallbackGeometry = mergeGeometriesForStlExport(
      splitSource.geometries.map((entry) => entry.geometry),
    );
    const fallbackPrepared = fallbackGeometry
      ? stlModule.prepareGeometryForStlExport(fallbackGeometry)
      : null;
    const compositeFallbackGeometry = mergeGeometriesForStlExport(
      (buildResult.crystalStlCompositeGeometries ?? []).map((geometry) => {
        if (!geometry) {
          return null;
        }
        const clone = geometry.clone();
        clone.scale(
          splitSource.scaleFactor,
          splitSource.scaleFactor,
          splitSource.scaleFactor,
        );
        clone.computeVertexNormals();
        clone.computeBoundingBox();
        clone.computeBoundingSphere();
        return clone;
      }),
    );
    const compositePrepared = compositeFallbackGeometry
      ? stlModule.prepareGeometryForStlExport(compositeFallbackGeometry)
      : null;
    const selection = selectTwinStlSource({
      unionScore: scoreStlTopology(unionPrepared.debug),
      fallbackScore: fallbackPrepared
        ? scoreStlTopology(fallbackPrepared.debug)
        : null,
      compositeScore: compositePrepared
        ? scoreStlTopology(compositePrepared.debug)
        : null,
      hasActiveFaceText,
      activeCrystalCount,
    });
    const splitGeometrySource =
      selection.selectedSource === "composited-crystal-stl-geometries"
        ? compositePrepared?.geometry
        : selection.selectedSource === "merged-crystal-preview-geometries"
          ? fallbackPrepared?.geometry
          : unionPrepared.geometry;
    if (!splitGeometrySource) {
      return null;
    }

    const planeNormal = twinPlaneNormal(
      context.state.stlSplit.plane,
      context.state.parameters,
    );
    if (
      !Number.isFinite(planeNormal.lengthSq()) ||
      planeNormal.lengthSq() === 0
    ) {
      return null;
    }
    const maxDimension = Math.max(
      getGeometryMaxDimension(splitGeometrySource),
      getGeometryMaxDimension(splitSource.crystalOneGeometry),
      1,
    );
    const halfSpaceSize = maxDimension * 6;
    const split = splitBufferGeometryByPlaneWithJscad(
      splitGeometrySource,
      crystalOneCenter,
      planeNormal,
      halfSpaceSize,
    );
    const mergedPositive = fillOpenEdgeLoops(
      split.positive
        ? stlModule.prepareGeometryForStlExport(split.positive).geometry
        : null,
    );
    const mergedNegative = fillOpenEdgeLoops(
      split.negative
        ? stlModule.prepareGeometryForStlExport(split.negative).geometry
        : null,
    );
    if (!mergedPositive && !mergedNegative) {
      return null;
    }

    const positiveExtent = getGeometryMaxDimension(mergedPositive);
    const negativeExtent = getGeometryMaxDimension(mergedNegative);
    const splitGapMm = 2;
    const separationDistance =
      positiveExtent * 0.5 + negativeExtent * 0.5 + splitGapMm;
    const positiveOffset = planeNormal
      .clone()
      .multiplyScalar(separationDistance * 0.5);
    const negativeOffset = planeNormal
      .clone()
      .multiplyScalar(-separationDistance * 0.5);

    mergedPositive?.translate(
      positiveOffset.x,
      positiveOffset.y,
      positiveOffset.z,
    );
    mergedNegative?.translate(
      negativeOffset.x,
      negativeOffset.y,
      negativeOffset.z,
    );

    const splitGeometry = mergeGeometriesForStlExport([
      mergedPositive,
      mergedNegative,
    ]);
    if (!splitGeometry) {
      return null;
    }

    const artifact = stlModule.buildStlExportArtifact(splitGeometry);
    return {
      ...artifact,
      debug: {
        ...artifact.debug,
        selectedSource: "visible-crystal-plane-split",
        splitInputSource: selection.selectedSource,
        visibleCrystalIndexes: splitSource.visibleIndexes,
        planePoint: {
          x: crystalOneCenter.x,
          y: crystalOneCenter.y,
          z: crystalOneCenter.z,
        },
        planeNormal: {
          x: planeNormal.x,
          y: planeNormal.y,
          z: planeNormal.z,
        },
        configuredPlaneIndices: {
          h: Number(context.state.stlSplit.plane?.h ?? 1),
          k: Number(context.state.stlSplit.plane?.k ?? 1),
          ...(typeof context.state.stlSplit.plane?.i === "number"
            ? { i: Number(context.state.stlSplit.plane?.i ?? 0) }
            : {}),
          l: Number(context.state.stlSplit.plane?.l ?? 1),
        },
        splitGapMm,
        separationDistance,
        previewToFinalScaleFactor: splitSource.scaleFactor,
        visibleCrystalCount: splitSource.visibleIndexes.length,
        splitSourceScore: {
          union: selection.unionScore,
          fallback: selection.fallbackScore,
          composite: selection.compositeScore,
        },
        positivePartCount: mergedPositive ? 1 : 0,
        negativePartCount: mergedNegative ? 1 : 0,
      },
    };
  }

  /**
   * 双晶データまたは preview 画像を現在の保存モードで書き出す。
   *
   * format ごとに生成物と保存 API が異なるためここで分岐する。
   * 副作用として download を発火し、失敗時は alert を出す。
   */
  async function exportTwinArtifact(
    format: "json" | "stl" | "svg" | "png" | "jpeg",
    saveMode: "save" | "save-as",
  ) {
    if (format === "json") {
      const defaultFilename = `${getExportBaseFilename("twin-parameters")}.json`;
      const payload = JSON.stringify(
        createTwinPreviewSettingsDocument({
          parameters: serializeTwinParameters(context.state.parameters),
          faceDisplayMode: context.state.faceDisplayMode,
          previewStyleSettings: context.state.previewStyleSettings,
        }),
        null,
        2,
      );
      if (saveMode === "save-as") {
        await triggerNamedDownload(
          payload,
          defaultFilename,
          "application/json",
          ".json",
        );
        return;
      }
      triggerDownload(payload, defaultFilename, "application/json");
      return;
    }

    if (format === "stl") {
      if (!context.state.buildResult?.finalGeometry) {
        return;
      }
      const defaultFilename = `${getExportBaseFilename("twin-model")}.stl`;
      const artifact =
        context.state.stlSplit.enabled === true
          ? await buildSplitTwinStlArtifact(context.state.buildResult)
          : await buildTwinStlArtifact(context.state.buildResult);
      if (!artifact) {
        context.alert(
          t("export.error.splitStlPlane", {
            message: context.state.stlSplit.enabled
              ? t("export.error.splitPlaneInvalid")
              : t("export.error.exportCanvas"),
          }),
        );
        return;
      }
      const stlModule = await loadTwinStlModule();
      if (saveMode === "save-as") {
        await triggerNamedDownload(
          artifact.content,
          defaultFilename,
          stlModule.STL_FORMAT.mimeType,
          `.${stlModule.STL_FORMAT.extension}`,
        );
        return;
      }
      triggerDownload(
        artifact.content,
        defaultFilename,
        stlModule.STL_FORMAT.mimeType,
      );
      return;
    }

    if (format === "svg") {
      try {
        const defaultFilename = `${getExportBaseFilename("twin-preview")}.svg`;
        const usesVectorBody = context.shouldUseVectorCrystalBodyForSvgExport();
        const svgMarkup = usesVectorBody
          ? getPreviewSvgMarkup(context.buildPreviewExportSvg())
          : context.buildPreviewRasterBackedSvg();
        if (saveMode === "save-as") {
          await triggerNamedDownload(
            svgMarkup,
            defaultFilename,
            "image/svg+xml;charset=utf-8",
            ".svg",
          );
          return;
        }
        triggerDownload(
          svgMarkup,
          defaultFilename,
          "image/svg+xml;charset=utf-8",
        );
      } catch (error) {
        context.alert(
          t("export.failed.svg", {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return;
    }

    if (format === "png") {
      try {
        const defaultFilename = `${getExportBaseFilename("twin-preview")}.png`;
        const pngBlob = await context.buildPreviewPngBlob();
        if (saveMode === "save-as") {
          await triggerNamedBlobDownload(
            pngBlob,
            defaultFilename,
            "image/png",
            ".png",
          );
          return;
        }
        triggerBlobDownload(pngBlob, defaultFilename);
      } catch (error) {
        context.alert(
          t("export.failed.png", {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
      return;
    }

    if (format === "jpeg") {
      try {
        const defaultFilename = `${getExportBaseFilename("twin-preview")}.jpg`;
        const jpegBlob = await context.buildPreviewJpegBlob();
        if (saveMode === "save-as") {
          await triggerNamedBlobDownload(
            jpegBlob,
            defaultFilename,
            "image/jpeg",
            ".jpg",
          );
          return;
        }
        triggerBlobDownload(jpegBlob, defaultFilename);
      } catch (error) {
        context.alert(
          t("export.failed.jpeg", {
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
  }

  return {
    getExportBaseFilename,
    exportTwinArtifact,
  };
}
