import * as THREE from "three";
import { FACE_TEXT_DEFAULTS } from "../constants.js";
import { buildThreeGeometry } from "../io/exporters.js";
import type { CrystalSystemId } from "../domain/crystalSystems.js";
import type { TwinPreviewStyleSettings } from "./previewStyleSettings.js";
import {
  resolveTwinPreviewFaceBaseColor,
  resolveTwinPreviewFaceOpacity,
  resolveTwinPreviewFaceProfile,
} from "./previewProfiles.js";
import { buildTwinFaceGroupPalette } from "../ui/faceTable/faceTable.js";
import {
  clipConvexPolygon2D,
  computeSignedPolygonArea2D,
  ensureCounterClockwise,
} from "../export/svgPolygonHelpers.js";

/**
 * preview 用の面色・display geometry・共有面 overlay を組み立てる module。
 *
 * `previewScene` が必要とする callback を 1 箇所へ寄せて、entry 側から
 * preview-specific な mesh 構築詳細を外すために使う。
 */

interface PreviewVertexLike {
  x: number;
  y: number;
  z: number;
}

interface PreviewFaceLike {
  id?: string | null;
  coefficient?: number;
  normal?: PreviewVertexLike;
  vertices?: PreviewVertexLike[];
  text?: {
    content?: string;
    fontId?: string;
    fontSize?: number;
    depth?: number;
    offsetU?: number;
    offsetV?: number;
    rotationDeg?: number;
  };
}

interface PreviewMeshDataLike {
  positions?: number[];
  faces?: PreviewFaceLike[];
  faceVertexCounts?: {
    id: string;
    vertexCount: number;
  }[];
}

interface PreviewAxisGuideLike {
  start?: PreviewVertexLike;
  end?: PreviewVertexLike;
}

interface PreviewStateLike {
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
  parameters: {
    crystalSystem: CrystalSystemId;
  };
}

interface VisibleCrystalEntryLike {
  index: number;
  meshData?: PreviewMeshDataLike | null;
}

function buildSharedFaceColorKey(
  crystalIndex: number | null | undefined,
  faceId: string | null | undefined,
) {
  return `${crystalIndex ?? "unknown"}:${faceId ?? ""}`;
}

/** preview geometry builder が参照する最小限の依存関係。 */
export interface TwinPreviewGeometryContext {
  state: PreviewStateLike;
  getCrystalAccentColor: (index: number) => THREE.ColorRepresentation;
  createWireframeFromPositionAttribute: (
    positionAttribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
    options?: {
      color?: THREE.ColorRepresentation;
      opacity?: number;
      linewidth?: number;
      depthTest?: boolean;
      renderOrder?: number;
    },
  ) => THREE.Object3D;
}

/** 複数色の平均色を返す。共有面 overlay や shared-face 混色に使う。 */
function averageColors(colors: THREE.Color[]) {
  const color = new THREE.Color(0, 0, 0);
  if (colors.length === 0) {
    return color;
  }
  colors.forEach((item) => color.add(item));
  return color.multiplyScalar(1 / colors.length);
}

/** 頂点列の重心を返す。xray mesh や pick target の基準点に使う。 */
function buildFaceCenter(vertices: PreviewVertexLike[]) {
  const center = new THREE.Vector3();
  if (!Array.isArray(vertices) || vertices.length === 0) {
    return center;
  }
  vertices.forEach((vertex) => {
    center.x += vertex.x;
    center.y += vertex.y;
    center.z += vertex.z;
  });
  return center.multiplyScalar(1 / vertices.length);
}

/** 頂点列の axis-aligned bounding box を軽量 object で返す。 */
function buildVertexBounds(vertices: PreviewVertexLike[]) {
  if (!Array.isArray(vertices) || vertices.length === 0) {
    return null;
  }
  const bounds = vertices.reduce(
    (accumulator, vertex) => ({
      minX: Math.min(accumulator.minX, vertex.x),
      maxX: Math.max(accumulator.maxX, vertex.x),
      minY: Math.min(accumulator.minY, vertex.y),
      maxY: Math.max(accumulator.maxY, vertex.y),
      minZ: Math.min(accumulator.minZ, vertex.z),
      maxZ: Math.max(accumulator.maxZ, vertex.z),
    }),
    {
      minX: Infinity,
      maxX: -Infinity,
      minY: Infinity,
      maxY: -Infinity,
      minZ: Infinity,
      maxZ: -Infinity,
    },
  );
  return {
    minX: Number(bounds.minX.toFixed(3)),
    maxX: Number(bounds.maxX.toFixed(3)),
    minY: Number(bounds.minY.toFixed(3)),
    maxY: Number(bounds.maxY.toFixed(3)),
    minZ: Number(bounds.minZ.toFixed(3)),
    maxZ: Number(bounds.maxZ.toFixed(3)),
    sizeX: Number((bounds.maxX - bounds.minX).toFixed(3)),
    sizeY: Number((bounds.maxY - bounds.minY).toFixed(3)),
    sizeZ: Number((bounds.maxZ - bounds.minZ).toFixed(3)),
  };
}

/** faceVertexCounts の並びから、対象 face の三角形頂点列を抜き出す。 */
function collectFaceTriangleVertices(
  meshData: PreviewMeshDataLike,
  faceId: string | null | undefined,
) {
  if (!faceId || !Array.isArray(meshData.positions)) {
    return [];
  }
  let offset = 0;
  for (const item of meshData.faceVertexCounts ?? []) {
    const vertexCount = Number(item.vertexCount ?? 0);
    if (item.id === faceId) {
      const vertices: PreviewVertexLike[] = [];
      for (let index = 0; index < vertexCount; index += 1) {
        const baseIndex = (offset + index) * 3;
        vertices.push({
          x: meshData.positions[baseIndex] ?? 0,
          y: meshData.positions[baseIndex + 1] ?? 0,
          z: meshData.positions[baseIndex + 2] ?? 0,
        });
      }
      return vertices;
    }
    offset += vertexCount;
  }
  return [];
}

/** 共面 face 検出用に、頂点集合だけで決まる安定 signature を返す。 */
function buildSharedFaceSignature(face: PreviewFaceLike) {
  const vertices = Array.isArray(face?.vertices) ? face.vertices : [];
  if (vertices.length < 3) {
    return null;
  }
  return vertices
    .map((vertex) =>
      [
        Number(vertex.x).toFixed(4),
        Number(vertex.y).toFixed(4),
        Number(vertex.z).toFixed(4),
      ].join(","),
    )
    .sort()
    .join("|");
}

/** plane 上へ 2D 投影するための直交基底を法線から作る。 */
function buildPlaneBasis(normal: THREE.Vector3) {
  const reference =
    Math.abs(normal.z) < 0.9
      ? new THREE.Vector3(0, 0, 1)
      : new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3()
    .crossVectors(reference, normal)
    .normalize();
  const bitangent = new THREE.Vector3()
    .crossVectors(normal, tangent)
    .normalize();
  return { tangent, bitangent };
}

/** face の world 頂点列を指定 plane basis 上の 2D 座標へ投影する。 */
function projectFaceVerticesToPlane(
  vertices: PreviewVertexLike[],
  origin: THREE.Vector3,
  tangent: THREE.Vector3,
  bitangent: THREE.Vector3,
) {
  return vertices.map((vertex) => {
    const point = new THREE.Vector3(vertex.x, vertex.y, vertex.z).sub(origin);
    return {
      x: point.dot(tangent),
      y: point.dot(bitangent),
    };
  });
}

/** preview geometry 関連 action 群を返す。 */
export function createTwinPreviewGeometryActions(
  context: TwinPreviewGeometryContext,
) {
  /** 共有している共面 face を検出し、不透明 solid 用の混色マップを作る。 */
  function buildSharedSolidFaceColorMap(
    visibleCrystalEntries: VisibleCrystalEntryLike[],
  ) {
    const entriesBySignature = new Map<
      string,
      { crystalIndex: number; faceId: string }[]
    >();

    visibleCrystalEntries.forEach(({ index, meshData }) => {
      (meshData?.faces ?? []).forEach((face) => {
        const signature = buildSharedFaceSignature(face);
        if (!signature || !face?.id) {
          return;
        }
        if (!entriesBySignature.has(signature)) {
          entriesBySignature.set(signature, []);
        }
        entriesBySignature.get(signature)?.push({
          crystalIndex: index,
          faceId: face.id,
        });
      });
    });

    const colorByFaceId = new Map<string, string>();
    entriesBySignature.forEach((entries) => {
      const uniqueCrystalIndices = [
        ...new Set(entries.map((entry) => entry.crystalIndex)),
      ];
      if (uniqueCrystalIndices.length < 2) {
        return;
      }
      const mixedColor = averageColors(
        uniqueCrystalIndices.map(
          (index) => new THREE.Color(context.getCrystalAccentColor(index)),
        ),
      );
      const mixedHex = `#${mixedColor.getHexString()}`;
      entries.forEach((entry) => {
        colorByFaceId.set(
          buildSharedFaceColorKey(entry.crystalIndex, entry.faceId),
          mixedHex,
        );
      });
    });
    return colorByFaceId;
  }

  /**
   * 不透明 solid preview で、共有面の重なり部分だけへ混色 overlay を作る。
   *
   * 面全体を塗ると過剰に濃くなるため、同一 plane 上で clip した交差 polygon だけを
   * 小さな mesh として追加する。
   */
  function buildSolidSharedFaceOverlayGroup(
    visibleCrystalEntries: VisibleCrystalEntryLike[],
  ) {
    const group = new THREE.Group();
    const seen = new Set<string>();
    const planeTolerance = 1e-4;
    const areaTolerance = 1e-3;

    for (
      let leftIndex = 0;
      leftIndex < visibleCrystalEntries.length - 1;
      leftIndex += 1
    ) {
      const leftEntry = visibleCrystalEntries[leftIndex];
      const leftFaces = leftEntry.meshData?.faces ?? [];
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < visibleCrystalEntries.length;
        rightIndex += 1
      ) {
        const rightEntry = visibleCrystalEntries[rightIndex];
        const rightFaces = rightEntry.meshData?.faces ?? [];
        const mixedColor = averageColors([
          new THREE.Color(context.getCrystalAccentColor(leftEntry.index)),
          new THREE.Color(context.getCrystalAccentColor(rightEntry.index)),
        ]);

        for (const leftFace of leftFaces) {
          if (!leftFace?.vertices?.length || !leftFace?.normal) {
            continue;
          }
          const leftNormal = new THREE.Vector3(
            leftFace.normal.x,
            leftFace.normal.y,
            leftFace.normal.z,
          ).normalize();
          const origin = new THREE.Vector3(
            leftFace.vertices[0].x,
            leftFace.vertices[0].y,
            leftFace.vertices[0].z,
          );

          for (const rightFace of rightFaces) {
            if (!rightFace?.vertices?.length || !rightFace?.normal) {
              continue;
            }
            const rightNormal = new THREE.Vector3(
              rightFace.normal.x,
              rightFace.normal.y,
              rightFace.normal.z,
            ).normalize();
            const normalDot = leftNormal.dot(rightNormal);
            if (Math.abs(Math.abs(normalDot) - 1) > 1e-4) {
              continue;
            }
            const rightPoint = new THREE.Vector3(
              rightFace.vertices[0].x,
              rightFace.vertices[0].y,
              rightFace.vertices[0].z,
            );
            const planeDistance = Math.abs(
              leftNormal.dot(rightPoint.clone().sub(origin)),
            );
            if (planeDistance > planeTolerance) {
              continue;
            }

            const referenceNormal =
              normalDot < 0 ? leftNormal.clone().negate() : leftNormal.clone();
            const { tangent, bitangent } = buildPlaneBasis(referenceNormal);
            const leftPolygon = ensureCounterClockwise(
              projectFaceVerticesToPlane(
                leftFace.vertices,
                origin,
                tangent,
                bitangent,
              ),
            );
            const rightPolygon = ensureCounterClockwise(
              projectFaceVerticesToPlane(
                rightFace.vertices,
                origin,
                tangent,
                bitangent,
              ),
            );
            const overlapPolygon = clipConvexPolygon2D(
              leftPolygon,
              rightPolygon,
            );
            if (
              overlapPolygon.length < 3 ||
              Math.abs(computeSignedPolygonArea2D(overlapPolygon)) <
                areaTolerance
            ) {
              continue;
            }

            const overlapVertices = overlapPolygon.map((point) =>
              origin
                .clone()
                .addScaledVector(tangent, point.x)
                .addScaledVector(bitangent, point.y),
            );
            const key = overlapVertices
              .map((vertex) =>
                [vertex.x, vertex.y, vertex.z]
                  .map((value) => value.toFixed(4))
                  .join(","),
              )
              .sort()
              .join("|");
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);

            const positions: number[] = [];
            for (
              let overlapIndex = 1;
              overlapIndex < overlapVertices.length - 1;
              overlapIndex += 1
            ) {
              [
                overlapVertices[0],
                overlapVertices[overlapIndex],
                overlapVertices[overlapIndex + 1],
              ].forEach((vertex) => {
                positions.push(vertex.x, vertex.y, vertex.z);
              });
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute(
              "position",
              new THREE.Float32BufferAttribute(positions, 3),
            );
            geometry.computeVertexNormals();
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            const material = new THREE.MeshPhysicalMaterial({
              color: mixedColor,
              roughness: 0.35,
              metalness: 0.08,
              clearcoat: 0.28,
              side: THREE.DoubleSide,
              polygonOffset: true,
              polygonOffsetFactor: -1,
              polygonOffsetUnits: -2,
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.renderOrder = 2;
            group.add(mesh);
          }
        }
      }
    }

    return group.children.length > 0 ? group : null;
  }

  /** grouped/solid preview 用の per-vertex color 配列を face ごとに作る。 */
  function buildPreviewFaceColors(
    meshData: PreviewMeshDataLike,
    sourceFaces: PreviewFaceLike[],
    options: {
      faceColorHexByFaceId?: Map<string, string> | null;
      crystalIndex?: number | null;
      crystalAccentColor?: THREE.ColorRepresentation | null;
    } = {},
  ) {
    const faceProfile = resolveTwinPreviewFaceProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings?.customFaceProfile,
    );
    const {
      faceColorHexByFaceId = null,
      crystalIndex = null,
      crystalAccentColor = null,
    } = options;
    if (
      !faceProfile.useVertexColorsOnMergedGeometry &&
      !faceColorHexByFaceId?.size
    ) {
      return [];
    }

    const { faceColors } = buildTwinFaceGroupPalette(
      sourceFaces,
      context.state.parameters.crystalSystem,
    );
    const fallbackFaceColor = resolveTwinPreviewFaceBaseColor(faceProfile, {
      crystalAccentColor:
        crystalAccentColor != null ? crystalAccentColor : undefined,
      useVertexColors: false,
    });
    const colors: number[] = [];

    for (const faceVertexCount of meshData.faceVertexCounts ?? []) {
      const color = new THREE.Color(
        faceColorHexByFaceId?.get(
          buildSharedFaceColorKey(crystalIndex, faceVertexCount.id),
        ) ??
          faceColorHexByFaceId?.get(faceVertexCount.id) ??
          (faceProfile.usesFaceGroupPalette
            ? faceColors.get(faceVertexCount.id)?.preview
            : fallbackFaceColor) ??
          "#d1b36a",
      );
      for (let index = 0; index < faceVertexCount.vertexCount; index += 1) {
        colors.push(color.r, color.g, color.b);
      }
    }

    return colors;
  }

  /** 指定 1 色で塗るための per-vertex color 配列を作る。 */
  function buildFlatFaceColors(
    meshData: PreviewMeshDataLike,
    colorHex: string,
  ) {
    const color = new THREE.Color(colorHex ?? "#d1b36a");
    const colors: number[] = [];

    for (const faceVertexCount of meshData.faceVertexCounts ?? []) {
      for (let index = 0; index < faceVertexCount.vertexCount; index += 1) {
        colors.push(color.r, color.g, color.b);
      }
    }

    return colors;
  }

  /** preview 表示用に color attribute 付き geometry を組み立てる。 */
  function buildDisplayGeometry(
    meshData: PreviewMeshDataLike | null | undefined,
    sourceFaces: PreviewFaceLike[],
    options: {
      faceColorHexByFaceId?: Map<string, string> | null;
      crystalIndex?: number | null;
      crystalAccentColor?: THREE.ColorRepresentation | null;
    } = {},
  ) {
    if (!meshData) {
      return null;
    }

    return buildThreeGeometry({
      ...meshData,
      colors: buildPreviewFaceColors(meshData, sourceFaces, options),
    });
  }

  /** grouped / xray-grouped 用の face 単位 mesh group を作る。 */
  function createGroupedFaceMeshGroup(
    meshData: PreviewMeshDataLike,
    sourceName: string,
    sourceFaces: PreviewFaceLike[],
    crystalIndex: number,
  ) {
    const faceProfile = resolveTwinPreviewFaceProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings?.customFaceProfile,
    );
    const group = new THREE.Group();
    group.name = sourceName;
    if (
      faceProfile.componentBuildMode === "grouped-face-group" &&
      !faceProfile.usesScreenSpaceFaceOverlay
    ) {
      const geometry = buildDisplayGeometry(meshData, sourceFaces);
      if (!geometry) {
        return group;
      }

      const textFaces = sourceFaces
        .filter((face) => String(face?.text?.content ?? "").trim() !== "")
        .map((face) => ({
          id: face.id ?? null,
          content: String(face.text?.content ?? ""),
          fontSize: Number(face.text?.fontSize ?? FACE_TEXT_DEFAULTS.fontSize),
          depth: Number(face.text?.depth ?? FACE_TEXT_DEFAULTS.depth),
          offsetU: Number(face.text?.offsetU ?? FACE_TEXT_DEFAULTS.offsetU),
          offsetV: Number(face.text?.offsetV ?? FACE_TEXT_DEFAULTS.offsetV),
          rotationDeg: Number(
            face.text?.rotationDeg ?? FACE_TEXT_DEFAULTS.rotationDeg,
          ),
          polygonBounds: buildVertexBounds(face.vertices ?? []),
          triangleBounds: buildVertexBounds(
            collectFaceTriangleVertices(meshData, face.id),
          ),
        }));
      if (textFaces.length > 0) {
        const summary = {
          sourceName,
          mode: context.state.faceDisplayMode,
          textFaces,
          meshPositionsCount: Array.isArray(meshData.positions)
            ? meshData.positions.length / 3
            : 0,
          geometryPositionsCount: geometry.getAttribute("position")?.count ?? 0,
          faceVertexCounts:
            meshData.faceVertexCounts?.map((item) => ({
              id: item.id,
              vertexCount: item.vertexCount,
            })) ?? [],
        };
        group.userData.faceTextGroupedDebug = summary;
        globalThis.__faceTextGroupedPreviewDebug = summary;
        console.info("[Face Text Grouped Preview]", summary);
      }

      const mesh = new THREE.Mesh(
        geometry,
        (() => {
          const opacity = resolveTwinPreviewFaceOpacity(faceProfile, {
            hasFinal: true,
            preferGroupedFaceComponentOpacity: true,
          });
          const useVertexColors = faceProfile.useVertexColorsOnMergedGeometry;
          const baseMaterialOptions = {
            color: resolveTwinPreviewFaceBaseColor(faceProfile, {
              crystalAccentColor: context.getCrystalAccentColor(crystalIndex),
              useVertexColors,
            }),
            vertexColors: useVertexColors,
            transparent: opacity < 1,
            opacity,
            side: THREE.DoubleSide,
            depthWrite: faceProfile.depthWrite,
            polygonOffset: faceProfile.usePolygonOffset,
            polygonOffsetFactor: faceProfile.polygonOffsetFactor,
            polygonOffsetUnits: faceProfile.polygonOffsetUnits,
          };
          return faceProfile.materialKind === "basic" ||
            !faceProfile.usesLighting
            ? new THREE.MeshBasicMaterial(baseMaterialOptions)
            : new THREE.MeshPhysicalMaterial({
                ...baseMaterialOptions,
                roughness: 0.35,
                metalness: 0.08,
                clearcoat: 0.28,
              });
        })(),
      );
      group.add(mesh);
      return group;
    }

    const { faceColors } = buildTwinFaceGroupPalette(
      sourceFaces,
      context.state.parameters.crystalSystem,
    );
    const validSourceFaces = sourceFaces.filter(
      (face) => Number(face.coefficient) > 0,
    );

    for (const [faceIndex, face] of (meshData.faces ?? []).entries()) {
      const vertices = face.vertices ?? [];
      if (vertices.length < 3) {
        continue;
      }

      const positions: number[] = [];
      for (let index = 1; index < vertices.length - 1; index += 1) {
        const triangle = [vertices[0], vertices[index], vertices[index + 1]];
        triangle.forEach((vertex) => {
          positions.push(vertex.x, vertex.y, vertex.z);
        });
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const fallbackFace = validSourceFaces[faceIndex];
      const paletteColor =
        (faceProfile.usesFaceGroupPalette
          ? (faceColors.get(face.id ?? "")?.preview ??
            faceColors.get(fallbackFace?.id ?? "")?.preview)
          : null) ?? "#d1b36a";
      const color = resolveTwinPreviewFaceBaseColor(faceProfile, {
        crystalAccentColor: paletteColor,
      });
      const opacity = resolveTwinPreviewFaceOpacity(faceProfile, {
        hasFinal: false,
        preferGroupedFaceComponentOpacity: true,
      });
      const baseMaterialOptions = {
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: faceProfile.depthWrite,
        side: THREE.DoubleSide,
        polygonOffset: faceProfile.usePolygonOffset,
        polygonOffsetFactor: faceProfile.polygonOffsetFactor,
        polygonOffsetUnits: faceProfile.polygonOffsetUnits,
      };
      const material = faceProfile.usesScreenSpaceFaceOverlay
        ? new THREE.MeshBasicMaterial({
            ...baseMaterialOptions,
          })
        : faceProfile.materialKind === "basic" || !faceProfile.usesLighting
          ? new THREE.MeshBasicMaterial(baseMaterialOptions)
          : new THREE.MeshPhysicalMaterial({
              ...baseMaterialOptions,
              roughness: 0.35,
              metalness: 0.08,
              clearcoat: 0.28,
            });
      const mesh = new THREE.Mesh(geometry, material);
      if (faceProfile.usesScreenSpaceFaceOverlay) {
        mesh.renderOrder = 4;
        mesh.userData.xrayTransparentFace = true;
        mesh.userData.xrayFaceCenter = buildFaceCenter(vertices);
        mesh.userData.xrayFaceNormal = new THREE.Vector3(
          face.normal?.x ?? 0,
          face.normal?.y ?? 0,
          face.normal?.z ?? 1,
        ).normalize();
      }
      group.add(mesh);
    }

    return group;
  }

  /** xray-solid 用の結晶別 face mesh group を作る。 */
  function createXraySolidFaceMeshGroup(
    meshData: PreviewMeshDataLike,
    sourceName: string,
    crystalIndex: number,
    hasFinal: boolean,
  ) {
    const faceProfile = resolveTwinPreviewFaceProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings?.customFaceProfile,
    );
    const group = new THREE.Group();
    group.name = sourceName;
    const crystalAccentColor = `#${new THREE.Color(context.getCrystalAccentColor(crystalIndex)).getHexString()}`;
    const opacity = resolveTwinPreviewFaceOpacity(faceProfile, { hasFinal });

    for (const face of meshData.faces ?? []) {
      const vertices = face.vertices ?? [];
      if (vertices.length < 3) {
        continue;
      }

      const positions: number[] = [];
      for (let index = 1; index < vertices.length - 1; index += 1) {
        const triangle = [vertices[0], vertices[index], vertices[index + 1]];
        triangle.forEach((vertex) => {
          positions.push(vertex.x, vertex.y, vertex.z);
        });
      }

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(positions, 3),
      );
      geometry.computeVertexNormals();
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();

      const color = resolveTwinPreviewFaceBaseColor(faceProfile, {
        crystalAccentColor,
      });
      const baseMaterialOptions = {
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: faceProfile.depthWrite,
        side: THREE.DoubleSide,
        polygonOffset: faceProfile.usePolygonOffset,
        polygonOffsetFactor: faceProfile.polygonOffsetFactor,
        polygonOffsetUnits: faceProfile.polygonOffsetUnits,
      };
      const material =
        faceProfile.materialKind === "basic" || !faceProfile.usesLighting
          ? new THREE.MeshBasicMaterial(baseMaterialOptions)
          : new THREE.MeshPhysicalMaterial({
              ...baseMaterialOptions,
              roughness: 0.35,
              metalness: 0.08,
              clearcoat: 0.28,
            });
      const mesh = new THREE.Mesh(geometry, material);
      if (faceProfile.usesScreenSpaceFaceOverlay) {
        mesh.renderOrder = 4;
        mesh.userData.xrayTransparentFace = true;
        mesh.userData.xrayFaceCenter = buildFaceCenter(vertices);
        mesh.userData.xrayFaceNormal = new THREE.Vector3(
          face.normal?.x ?? 0,
          face.normal?.y ?? 0,
          face.normal?.z ?? 1,
        ).normalize();
      }
      group.add(mesh);
    }

    return group;
  }

  /** geometry の edge を拾って preview 用 wireframe object を作る。 */
  function createWireframeFromGeometry(geometry: THREE.BufferGeometry) {
    const edgesGeometry = new THREE.EdgesGeometry(geometry, 1);
    const positionAttribute = edgesGeometry.getAttribute("position");
    const line =
      context.createWireframeFromPositionAttribute(positionAttribute);
    edgesGeometry.dispose();
    return line;
  }

  /** 3D 点が凸面内にあるかを判定する。交線・軸線の clipping に使う。 */
  function isPointInsideConvexFace3D(
    point: THREE.Vector3,
    vertices: PreviewVertexLike[],
    faceNormal: THREE.Vector3,
  ) {
    if (!Array.isArray(vertices) || vertices.length < 3) {
      return false;
    }

    const center = vertices
      .reduce(
        (accumulator, vertex) =>
          accumulator.add(new THREE.Vector3(vertex.x, vertex.y, vertex.z)),
        new THREE.Vector3(),
      )
      .multiplyScalar(1 / vertices.length);

    for (let index = 0; index < vertices.length; index += 1) {
      const startVertex = vertices[index];
      const endVertex = vertices[(index + 1) % vertices.length];
      const start = new THREE.Vector3(
        startVertex.x,
        startVertex.y,
        startVertex.z,
      );
      const end = new THREE.Vector3(endVertex.x, endVertex.y, endVertex.z);
      const edge = end.clone().sub(start);
      if (edge.lengthSq() < 1e-8) {
        continue;
      }
      const inwardNormal = new THREE.Vector3().crossVectors(faceNormal, edge);
      if (inwardNormal.dot(center.clone().sub(start)) < 0) {
        inwardNormal.negate();
      }
      if (inwardNormal.dot(point.clone().sub(start)) < -1e-5) {
        return false;
      }
    }

    return true;
  }

  /** 軸線と外周面の交差位置を 1 軸分まとめて集める。 */
  function collectAxisSurfaceIntersectionParameters(
    axis: PreviewAxisGuideLike,
    clipFaces: PreviewFaceLike[] | undefined,
  ) {
    if (!axis?.start || !axis?.end) {
      return [];
    }

    const start = new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z);
    const end = new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z);
    const direction = end.clone().sub(start);
    const axisLength = direction.length();
    if (axisLength <= 1e-8) {
      return [];
    }
    direction.normalize();

    const hits: number[] = [];
    for (const face of clipFaces ?? []) {
      if (!face?.vertices?.length || !face?.normal) {
        continue;
      }

      const faceNormal = new THREE.Vector3(
        face.normal.x,
        face.normal.y,
        face.normal.z,
      ).normalize();
      const denominator = faceNormal.dot(direction);
      if (Math.abs(denominator) < 1e-8) {
        continue;
      }

      const facePoint = new THREE.Vector3(
        face.vertices[0].x,
        face.vertices[0].y,
        face.vertices[0].z,
      );
      const t = faceNormal.dot(facePoint.clone().sub(start)) / denominator;
      if (t <= 1e-5 || t >= axisLength - 1e-5) {
        continue;
      }

      const hitPoint = start.clone().addScaledVector(direction, t);
      if (!isPointInsideConvexFace3D(hitPoint, face.vertices, faceNormal)) {
        continue;
      }
      hits.push(t);
    }

    return [...new Set(hits.map((value) => value.toFixed(6)))]
      .map(Number)
      .sort((left, right) => left - right);
  }

  /** 軸線の外側可視 segment を作る。 */
  function buildAxisOuterSegments(
    axis: PreviewAxisGuideLike,
    clipFaces: PreviewFaceLike[] | undefined,
  ) {
    if (!axis?.start || !axis?.end) {
      return [];
    }

    const start = new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z);
    const end = new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z);
    const direction = end.clone().sub(start);
    const axisLength = direction.length();
    if (axisLength <= 1e-8) {
      return [];
    }
    direction.normalize();
    const hits = collectAxisSurfaceIntersectionParameters(axis, clipFaces);

    if (hits.length < 2) {
      return [{ start, end }];
    }

    const firstHit = hits[0];
    const lastHit = hits[hits.length - 1];
    const segments: { start: THREE.Vector3; end: THREE.Vector3 }[] = [];

    const negativeOuterEnd = start
      .clone()
      .addScaledVector(direction, Math.max(0, firstHit - 1e-3));
    if (negativeOuterEnd.distanceToSquared(start) >= 1e-8) {
      segments.push({ start: start.clone(), end: negativeOuterEnd });
    }

    const positiveOuterStart = start
      .clone()
      .addScaledVector(direction, Math.min(axisLength, lastHit + 1e-3));
    if (positiveOuterStart.distanceToSquared(end) >= 1e-8) {
      segments.push({ start: positiveOuterStart, end: end.clone() });
    }

    return segments;
  }

  /** 軸線の内部表示 segment を作る。 */
  function buildAxisInnerSegment(
    axis: PreviewAxisGuideLike,
    clipFaces: PreviewFaceLike[] | undefined,
  ) {
    if (!axis?.start || !axis?.end) {
      return null;
    }

    const start = new THREE.Vector3(axis.start.x, axis.start.y, axis.start.z);
    const end = new THREE.Vector3(axis.end.x, axis.end.y, axis.end.z);
    const direction = end.clone().sub(start);
    const axisLength = direction.length();
    if (axisLength <= 1e-8) {
      return null;
    }
    direction.normalize();
    const hits = collectAxisSurfaceIntersectionParameters(axis, clipFaces);
    if (hits.length < 2) {
      return { start, end };
    }

    const firstHit = hits[0];
    const lastHit = hits[hits.length - 1];
    const clippedStart = start
      .clone()
      .addScaledVector(direction, Math.min(axisLength, firstHit + 1e-3));
    const clippedEnd = start
      .clone()
      .addScaledVector(direction, Math.max(0, lastHit - 1e-3));
    if (clippedEnd.distanceToSquared(clippedStart) < 1e-8) {
      return null;
    }

    return { start: clippedStart, end: clippedEnd };
  }

  return {
    buildFaceCenter,
    buildPlaneBasis,
    projectFaceVerticesToPlane,
    buildSharedSolidFaceColorMap,
    buildSolidSharedFaceOverlayGroup,
    buildPreviewFaceColors,
    buildFlatFaceColors,
    buildDisplayGeometry,
    createGroupedFaceMeshGroup,
    createXraySolidFaceMeshGroup,
    createWireframeFromGeometry,
    isPointInsideConvexFace3D,
    collectAxisSurfaceIntersectionParameters,
    buildAxisOuterSegments,
    buildAxisInnerSegment,
  };
}
