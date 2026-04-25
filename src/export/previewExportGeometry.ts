import * as THREE from "three";
import { resolveTwinPreviewFaceProfile } from "../preview/previewProfiles.js";
import {
  buildBoundaryExportLineKey,
  buildCanonicalExportPlaneKey,
  buildMergedExportPaths,
  doesBoundaryApplyToExportPlane,
  getVectorSvgBodyWorkSize,
} from "./svgExportPlaneHelpers.js";
import {
  buildSvgExportFaceDebugList,
  buildSvgSortTieDebugSummary,
  buildTwinSvgEdgeDebugSummary,
  createTwinSvgMergeFace,
  mergeAdjacentSplitPolygonsByFill,
  scaleExportPathCoordinates,
  scaleExportPolygonCoordinates,
  scaleOpaqueExportTriangles,
} from "./svgMergeHelpers.js";
import {
  applyLocalOverlapDepthSort,
  clipConvexPolygon2D,
  computeExportPolygonBackDepth,
  computeExportPolygonRepresentativeDepth,
  computeSignedPolygonArea2D,
  createExportSplitDebugAccumulator,
  distanceSquared2D,
  ensureCounterClockwise,
  normalizeSplitPolygonPoints,
  splitConvexPolygonByLineSegment,
} from "./svgPolygonHelpers.js";
import type { TwinPreviewStyleSettings } from "../preview/previewStyleSettings.js";
import {
  collectBlockingExportEdgeKeys,
  collectPreviewExportLines as collectPreviewExportLinesFromScene,
  isBoundaryExportLineObject,
} from "./previewExportLines.js";

/**
 * 双晶 preview export の polygon / line 生成本体。
 *
 * export helper 群をかなり外へ出した後でも、この塊は previewRoot / camera /
 * xray surface / boundary split が密に結びついて読みにくい。まずは context を
 * 受ける 1 module にまとめ、`main.ts` では「どの export を呼ぶか」だけを
 * 主責務に寄せる。
 */

interface PreviewExportGeometryStateLike {
  parameters: {
    crystalSystem: string;
  };
  previewRoot: THREE.Group | null;
  ridgeLines: THREE.Object3D | null;
  intersectionRidgeLines: THREE.Object3D | null;
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
}

interface PreviewExportGeometryVisibleCrystalEntryLike {
  crystal: {
    twinType?: string;
  } | null;
  index: number;
  meshData: {
    faces?:
      | {
          id?: string | null;
          normal?: { x: number; y: number; z: number } | null;
          vertices?: { x: number; y: number; z: number }[];
        }[]
      | null;
  } | null;
}

interface PreviewExportGeometrySurfaceLike {
  geometry?: THREE.BufferGeometry | null;
  rootMatrix?: THREE.Matrix4 | null;
  fillOpacity: number;
  useVertexColors?: boolean;
  fillColor?: string | null;
  colorResolver?:
    | ((
        sample: {
          projectedPoints?: { x: number; y: number }[];
          worldPoints?: THREE.Vector3[];
          worldNormal?: THREE.Vector3 | null;
        },
        fallbackFill: string,
      ) => string)
    | null;
  applyLighting?: boolean;
  lightingContext?: unknown;
  includeBackFacingTriangles?: boolean;
  sourceMode?: string;
}

export interface TwinPreviewExportGeometryContext {
  state: PreviewExportGeometryStateLike;
  camera: THREE.Camera;
  svgVectorBodyWorkLongEdge: number;
  getVisibleCrystalEntriesForExport: () => PreviewExportGeometryVisibleCrystalEntryLike[];
  projectWorldPointToExport: (
    worldPoint: THREE.Vector3,
    width: number,
    height: number,
  ) => { x: number; y: number; projectedZ: number; cameraZ: number };
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
  getExportMaterial: (
    object: THREE.Object3D & { material?: unknown },
  ) => unknown;
  collectVisibleWorldLineSegments: (
    startPoint: THREE.Vector3,
    endPoint: THREE.Vector3,
    width: number,
    height: number,
    surface: unknown,
  ) => { x1: number; y1: number; x2: number; y2: number }[];
  buildPreviewExportOcclusionMesh: (surface: unknown) => THREE.Object3D | null;
  isWorldLinePointVisibleForExport: (
    worldPoint: THREE.Vector3,
    surface: unknown,
    occlusionMesh: THREE.Object3D | null,
    visibilityEpsilon?: number,
  ) => boolean;
  getClosestOpaqueTriangleDepth: (
    point: { x: number; y: number },
    opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[],
  ) => number;
  isXrayFaceDisplayMode: () => boolean;
  createPreviewExportColorResolver: (
    width: number,
    height: number,
  ) => PreviewExportGeometrySurfaceLike["colorResolver"];
  applyPreviewLightingToSvgFill: (
    fill: string,
    worldNormal: THREE.Vector3 | null | undefined,
    lightingContext: unknown,
  ) => string;
  collectTransparentXrayExportTriangles: (
    width: number,
    height: number,
    rootMatrix?: THREE.Matrix4 | null,
  ) => {
    triangleEntries: {
      worldPoints: THREE.Vector3[];
      projectedPoints: { x: number; y: number; cameraZ: number }[];
      normal: THREE.Vector3;
      fill: string;
      fillOpacity: number;
    }[];
    rawTrianglePolygons: {
      points2d: { x: number; y: number; cameraZ: number }[];
      points: string;
      fill: string;
      fillOpacity: number;
      stroke: string;
      strokeOpacity: number;
      strokeWidth: number;
      sortDepth: number;
      backSortDepth: number;
      planeNormal?: THREE.Vector3;
      planePoint?: THREE.Vector3;
    }[];
    opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[];
  };
  getCrystalAccentColor: (index: number) => string;
  averageColors: (colors: THREE.Color[]) => THREE.Color;
  buildPlaneBasis: (normal: THREE.Vector3) => {
    tangent: THREE.Vector3;
    bitangent: THREE.Vector3;
  };
  projectFaceVerticesToPlane: (
    vertices: { x: number; y: number; z: number }[],
    origin: THREE.Vector3,
    tangent: THREE.Vector3,
    bitangent: THREE.Vector3,
  ) => { x: number; y: number }[];
  buildCrossCrystalIntersectionLinePositions: (
    visibleCrystalEntries: PreviewExportGeometryVisibleCrystalEntryLike[],
  ) => number[];
  buildIntersectionSegments: (
    intersectionPositions: number[],
  ) => { start: THREE.Vector3; end: THREE.Vector3 }[];
  collectRidgeSplitParameters: (
    segment: { start: THREE.Vector3; end: THREE.Vector3 },
    intersectionSegments: { start: THREE.Vector3; end: THREE.Vector3 }[],
    epsilon: number,
  ) => number[];
  buildOutlineSegmentKey: (start: THREE.Vector3, end: THREE.Vector3) => string;
  buildIntersectionLinePoint: (
    leftPoint: THREE.Vector3,
    leftNormal: THREE.Vector3,
    rightPoint: THREE.Vector3,
    rightNormal: THREE.Vector3,
    rawDirection: THREE.Vector3,
  ) => THREE.Vector3 | null;
  clipLineToConvexFace: (
    linePoint: THREE.Vector3,
    lineDirection: THREE.Vector3,
    vertices: { x: number; y: number; z: number }[],
    faceNormal: THREE.Vector3,
  ) => { minT: number; maxT: number } | null;
}

export function createTwinPreviewExportGeometryActions(
  context: TwinPreviewExportGeometryContext,
) {
  /** 1 triangle の最終 SVG fill を vertex color / resolver / lighting を踏まえて決める。 */
  function getTriangleExportFill(
    surface: PreviewExportGeometrySurfaceLike,
    colorAttribute: THREE.BufferAttribute | null,
    triangleStartIndex: number,
    projectedPoints: { x: number; y: number }[],
    worldPoints: THREE.Vector3[],
    worldNormal: THREE.Vector3,
  ) {
    let fill = surface.fillColor ?? "#d1b36a";
    if (surface.useVertexColors && colorAttribute) {
      const color = new THREE.Color(
        (colorAttribute.getX(triangleStartIndex) +
          colorAttribute.getX(triangleStartIndex + 1) +
          colorAttribute.getX(triangleStartIndex + 2)) /
          3,
        (colorAttribute.getY(triangleStartIndex) +
          colorAttribute.getY(triangleStartIndex + 1) +
          colorAttribute.getY(triangleStartIndex + 2)) /
          3,
        (colorAttribute.getZ(triangleStartIndex) +
          colorAttribute.getZ(triangleStartIndex + 1) +
          colorAttribute.getZ(triangleStartIndex + 2)) /
          3,
      );
      fill = `#${color.getHexString()}`;
    }

    if (surface.colorResolver) {
      fill = surface.colorResolver(
        { projectedPoints, worldPoints, worldNormal },
        fill,
      );
    }

    if (surface.applyLighting) {
      fill = context.applyPreviewLightingToSvgFill(
        fill,
        worldNormal,
        surface.lightingContext,
      );
    }

    return fill;
  }

  /** preview 上の line object 群を SVG line 群へ変換する。 */
  function collectPreviewExportLines(
    width: number,
    height: number,
    _opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[],
    surface: unknown,
    options: {
      includeObject?: ((object: THREE.Object3D) => boolean) | null;
    } = {},
  ) {
    return collectPreviewExportLinesFromScene({
      state: context.state,
      width,
      height,
      surface,
      includeObject: options.includeObject,
      hasNamedAncestor: context.hasNamedAncestor,
      getExportMaterial: context.getExportMaterial,
      collectVisibleWorldLineSegments: context.collectVisibleWorldLineSegments,
      projectWorldPointToExport: context.projectWorldPointToExport,
    });
  }

  /**
   * triangle split に使う可視 boundary line だけを export 線分として収集する。
   *
   * 一時的に ridge/intersection line を可視化し、通常の line export 経路を再利用する。
   */
  function collectVisibleBoundaryExportLinesForTriangleSplit(
    width: number,
    height: number,
    opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[],
    surface: unknown,
  ) {
    const visibilityTargets = [
      context.state.ridgeLines,
      context.state.intersectionRidgeLines,
    ].filter(Boolean) as THREE.Object3D[];
    const visibilitySnapshot = visibilityTargets.map((target) => ({
      target,
      visible: target.visible,
    }));

    try {
      visibilityTargets.forEach((target) => {
        target.visible = true;
      });
      return collectPreviewExportLines(
        width,
        height,
        opaqueTriangles,
        surface,
        {
          includeObject: (object) =>
            isBoundaryExportLineObject(context.hasNamedAncestor, object),
        },
      );
    } finally {
      visibilitySnapshot.forEach(({ target, visible }) => {
        target.visible = visible;
      });
    }
  }

  /** 各 face plane に属する ridge segment を plane-aware split 用に収集する。 */
  function collectPlaneAwareRidgeBoundarySegments(
    visibleCrystalEntries: PreviewExportGeometryVisibleCrystalEntryLike[],
    rootMatrix: THREE.Matrix4 | null = null,
  ) {
    const segments: {
      startWorld: THREE.Vector3;
      endWorld: THREE.Vector3;
      boundaryType: "ridge";
      planeKeys: string[];
    }[] = [];
    const emitted = new Set<string>();
    const intersectionPositions =
      context.buildCrossCrystalIntersectionLinePositions(visibleCrystalEntries);
    const intersectionSegments = context.buildIntersectionSegments(
      intersectionPositions,
    );
    const epsilon = 1e-5;
    const transformMatrix =
      rootMatrix ??
      context.state.previewRoot?.matrixWorld ??
      new THREE.Matrix4();

    visibleCrystalEntries.forEach((entry) => {
      (entry.meshData?.faces ?? []).forEach((face) => {
        const vertices = face.vertices ?? [];
        if (vertices.length < 2 || !face?.normal) {
          return;
        }

        const planeNormal = new THREE.Vector3(
          face.normal.x,
          face.normal.y,
          face.normal.z,
        )
          .transformDirection(transformMatrix)
          .normalize();
        const planePoint = new THREE.Vector3(
          vertices[0].x,
          vertices[0].y,
          vertices[0].z,
        ).applyMatrix4(transformMatrix);
        const planeKey = buildCanonicalExportPlaneKey(planeNormal, planePoint);

        for (let index = 0; index < vertices.length; index += 1) {
          const startVertex = vertices[index];
          const endVertex = vertices[(index + 1) % vertices.length];
          const segment = {
            start: new THREE.Vector3(
              startVertex.x,
              startVertex.y,
              startVertex.z,
            ).applyMatrix4(transformMatrix),
            end: new THREE.Vector3(
              endVertex.x,
              endVertex.y,
              endVertex.z,
            ).applyMatrix4(transformMatrix),
          };
          const params = context.collectRidgeSplitParameters(
            segment,
            intersectionSegments,
            epsilon,
          );
          for (
            let paramIndex = 0;
            paramIndex < params.length - 1;
            paramIndex += 1
          ) {
            const startT = params[paramIndex];
            const endT = params[paramIndex + 1];
            if (endT - startT < epsilon) {
              continue;
            }
            const start = segment.start.clone().lerp(segment.end, startT);
            const end = segment.start.clone().lerp(segment.end, endT);
            if (start.distanceToSquared(end) < epsilon * epsilon) {
              continue;
            }
            const key = `${context.buildOutlineSegmentKey(start, end)}|${planeKey}`;
            if (emitted.has(key)) {
              continue;
            }
            emitted.add(key);
            segments.push({
              startWorld: start,
              endWorld: end,
              boundaryType: "ridge",
              planeKeys: [planeKey],
            });
          }
        }
      });
    });

    return segments;
  }

  /** face plane 同士の交線 segment を plane-aware split 用に収集する。 */
  function collectPlaneAwareIntersectionBoundarySegments(
    visibleCrystalEntries: PreviewExportGeometryVisibleCrystalEntryLike[],
    rootMatrix: THREE.Matrix4 | null = null,
  ) {
    const segments: {
      startWorld: THREE.Vector3;
      endWorld: THREE.Vector3;
      boundaryType: "intersection";
      planeKeys: string[];
    }[] = [];
    const seen = new Set<string>();
    const epsilon = 1e-5;
    const transformMatrix =
      rootMatrix ??
      context.state.previewRoot?.matrixWorld ??
      new THREE.Matrix4();

    for (
      let leftIndex = 0;
      leftIndex < visibleCrystalEntries.length - 1;
      leftIndex += 1
    ) {
      const leftFaces = visibleCrystalEntries[leftIndex].meshData?.faces ?? [];
      for (
        let rightIndex = leftIndex + 1;
        rightIndex < visibleCrystalEntries.length;
        rightIndex += 1
      ) {
        const rightFaces =
          visibleCrystalEntries[rightIndex].meshData?.faces ?? [];
        for (const leftFace of leftFaces) {
          if (!leftFace?.vertices?.length || !leftFace?.normal) {
            continue;
          }
          const leftVertices = leftFace.vertices.map((vertex) => {
            const point = new THREE.Vector3(
              vertex.x,
              vertex.y,
              vertex.z,
            ).applyMatrix4(transformMatrix);
            return { x: point.x, y: point.y, z: point.z };
          });
          const leftNormal = new THREE.Vector3(
            leftFace.normal.x,
            leftFace.normal.y,
            leftFace.normal.z,
          )
            .transformDirection(transformMatrix)
            .normalize();
          const leftPoint = new THREE.Vector3(
            leftVertices[0].x,
            leftVertices[0].y,
            leftVertices[0].z,
          );
          const leftPlaneKey = buildCanonicalExportPlaneKey(
            leftNormal,
            leftPoint,
          );

          for (const rightFace of rightFaces) {
            if (!rightFace?.vertices?.length || !rightFace?.normal) {
              continue;
            }
            const rightVertices = rightFace.vertices.map((vertex) => {
              const point = new THREE.Vector3(
                vertex.x,
                vertex.y,
                vertex.z,
              ).applyMatrix4(transformMatrix);
              return { x: point.x, y: point.y, z: point.z };
            });
            const rightNormal = new THREE.Vector3(
              rightFace.normal.x,
              rightFace.normal.y,
              rightFace.normal.z,
            )
              .transformDirection(transformMatrix)
              .normalize();
            const rawDirection = new THREE.Vector3().crossVectors(
              leftNormal,
              rightNormal,
            );
            if (rawDirection.lengthSq() < 1e-8) {
              continue;
            }
            const direction = rawDirection.clone().normalize();
            const rightPoint = new THREE.Vector3(
              rightVertices[0].x,
              rightVertices[0].y,
              rightVertices[0].z,
            );
            const rightPlaneKey = buildCanonicalExportPlaneKey(
              rightNormal,
              rightPoint,
            );
            const linePoint = context.buildIntersectionLinePoint(
              leftPoint,
              leftNormal,
              rightPoint,
              rightNormal,
              rawDirection,
            );
            if (!linePoint) {
              continue;
            }

            const leftInterval = context.clipLineToConvexFace(
              linePoint,
              direction,
              leftVertices,
              leftNormal,
            );
            if (!leftInterval) {
              continue;
            }
            const rightInterval = context.clipLineToConvexFace(
              linePoint,
              direction,
              rightVertices,
              rightNormal,
            );
            if (!rightInterval) {
              continue;
            }

            const minT = Math.max(leftInterval.minT, rightInterval.minT);
            const maxT = Math.min(leftInterval.maxT, rightInterval.maxT);
            if (
              !Number.isFinite(minT) ||
              !Number.isFinite(maxT) ||
              maxT - minT < epsilon
            ) {
              continue;
            }

            const start = linePoint.clone().addScaledVector(direction, minT);
            const end = linePoint.clone().addScaledVector(direction, maxT);
            if (start.distanceToSquared(end) < epsilon * epsilon) {
              continue;
            }

            const ordered = [start, end].sort((a, b) =>
              a.x !== b.x ? a.x - b.x : a.y !== b.y ? a.y - b.y : a.z - b.z,
            );
            const key = `${ordered
              .map((point) =>
                [point.x, point.y, point.z]
                  .map((value) => value.toFixed(4))
                  .join(","),
              )
              .join("|")}|${[leftPlaneKey, rightPlaneKey].sort().join("|")}`;
            if (seen.has(key)) {
              continue;
            }
            seen.add(key);
            segments.push({
              startWorld: start,
              endWorld: end,
              boundaryType: "intersection",
              planeKeys: [leftPlaneKey, rightPlaneKey],
            });
          }
        }
      }
    }

    return segments;
  }

  /** screen-space 全 boundary line を triangle split 用に集約して返す。 */
  function collectAllBoundaryExportLinesForTriangleSplit(
    width: number,
    height: number,
  ) {
    const visibleCrystalEntries = context.getVisibleCrystalEntriesForExport();
    if (!visibleCrystalEntries.length) {
      return {
        lines: [] as {
          x1: number;
          y1: number;
          x2: number;
          y2: number;
          boundaryType: "ridge" | "intersection";
          planeKeys: string[];
        }[],
        debug: {
          ridgeLineCount: 0,
          intersectionLineCount: 0,
          dedupedLineCount: 0,
        },
      };
    }

    const rootMatrix =
      context.state.previewRoot?.matrixWorld ?? new THREE.Matrix4();
    const ridgeSegments = collectPlaneAwareRidgeBoundarySegments(
      visibleCrystalEntries,
      rootMatrix,
    );
    const intersectionSegments = collectPlaneAwareIntersectionBoundarySegments(
      visibleCrystalEntries,
      rootMatrix,
    );
    const lines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      boundaryType: "ridge" | "intersection";
      planeKeys: string[];
    }[] = [];
    const emitted = new Set<string>();
    const appendProjectedSegments = (
      segments: {
        startWorld: THREE.Vector3;
        endWorld: THREE.Vector3;
        boundaryType: "ridge" | "intersection";
        planeKeys: string[];
      }[],
    ) => {
      segments.forEach((segment) => {
        const start = context.projectWorldPointToExport(
          segment.startWorld,
          width,
          height,
        );
        const end = context.projectWorldPointToExport(
          segment.endWorld,
          width,
          height,
        );
        if (
          Math.abs(end.x - start.x) <= 1e-6 &&
          Math.abs(end.y - start.y) <= 1e-6
        ) {
          return;
        }
        const line = {
          x1: start.x,
          y1: start.y,
          x2: end.x,
          y2: end.y,
          boundaryType: segment.boundaryType,
          planeKeys: segment.planeKeys,
        };
        const key = buildBoundaryExportLineKey(line);
        if (emitted.has(key)) {
          return;
        }
        emitted.add(key);
        lines.push(line);
      });
    };

    appendProjectedSegments(ridgeSegments);
    appendProjectedSegments(intersectionSegments);
    return {
      lines,
      debug: {
        ridgeLineCount: ridgeSegments.length,
        intersectionLineCount: intersectionSegments.length,
        dedupedLineCount: lines.length,
      },
    };
  }

  /** 最終 polygon が boundary line をまだ跨いでいないかの debug 情報を作る。 */
  function buildBoundaryCrossingPolygonDebug(
    polygons: {
      points2d?: { x: number; y: number }[];
      fill?: string;
      fillOpacity?: number;
      sortDepth?: number;
      planeNormal?: THREE.Vector3;
      planePoint?: THREE.Vector3;
    }[],
    boundaryLines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      boundaryType?: string | null;
      planeKeys?: string[];
    }[],
    options: {
      maxSamples?: number;
      respectPlaneKeys?: boolean;
      label?: string | null;
    } = {},
  ) {
    const { maxSamples = 20, respectPlaneKeys = true, label = null } = options;
    if (!polygons.length || !boundaryLines.length) {
      return {
        label,
        respectPlaneKeys,
        crossingPolygonCount: 0,
        sampleCount: 0,
        samples: [],
      };
    }

    const samples: {
      polygonIndex: number;
      fill?: string;
      fillOpacity?: number;
      sortDepth?: number;
      pointCount: number;
      points: { x: number; y: number }[];
      crossingLines: {
        lineIndex: number;
        boundaryType: string | null;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[];
    }[] = [];
    let crossingPolygonCount = 0;
    polygons.forEach((polygon, polygonIndex) => {
      const points = polygon.points2d ?? [];
      if (points.length < 3) {
        return;
      }

      const matchingLines: {
        lineIndex: number;
        boundaryType: string | null;
        x1: number;
        y1: number;
        x2: number;
        y2: number;
      }[] = [];
      boundaryLines.forEach((line, lineIndex) => {
        if (
          respectPlaneKeys &&
          !doesBoundaryApplyToExportPlane(
            line,
            polygon.planeNormal,
            polygon.planePoint,
          )
        ) {
          return;
        }
        const splitPieces = splitConvexPolygonByLineSegment(points, {
          start: { x: Number(line.x1), y: Number(line.y1) },
          end: { x: Number(line.x2), y: Number(line.y2) },
        });
        if (splitPieces.length > 1) {
          matchingLines.push({
            lineIndex,
            boundaryType: line.boundaryType ?? null,
            x1: Number(line.x1),
            y1: Number(line.y1),
            x2: Number(line.x2),
            y2: Number(line.y2),
          });
        }
      });

      if (!matchingLines.length) {
        return;
      }
      crossingPolygonCount += 1;
      if (samples.length < maxSamples) {
        samples.push({
          polygonIndex,
          fill: polygon.fill,
          fillOpacity: polygon.fillOpacity,
          sortDepth: polygon.sortDepth,
          pointCount: points.length,
          points: points.map((point) => ({ x: point.x, y: point.y })),
          crossingLines: matchingLines.slice(0, 8),
        });
      }
    });

    return {
      label,
      respectPlaneKeys,
      crossingPolygonCount,
      sampleCount: samples.length,
      samples,
    };
  }

  /** triangle 由来 polygon 群を boundary line で分割し、split 後の深度も再計算する。 */
  function splitTriangleExportPolygonsByBoundaryLines(
    polygons: {
      points2d?: { x: number; y: number; cameraZ?: number }[];
      points: string;
      sortDepth: number;
      backSortDepth?: number;
      planeNormal?: THREE.Vector3;
      planePoint?: THREE.Vector3;
      [key: string]: unknown;
    }[],
    boundaryLines: {
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      planeKeys?: string[];
    }[],
    options: { respectPlaneKeys?: boolean } = {},
  ) {
    const { respectPlaneKeys = true } = options;
    if (!polygons.length || !boundaryLines.length) {
      const emptyDebug = {
        ...createExportSplitDebugAccumulator(),
        inputPolygonCount: polygons.length,
        respectPlaneKeys,
      };
      return {
        polygons,
        debug: emptyDebug,
      };
    }

    const debug: ReturnType<typeof createExportSplitDebugAccumulator> & {
      respectPlaneKeys?: boolean;
      outputPolygonCount?: number;
    } = createExportSplitDebugAccumulator();
    debug.inputPolygonCount = polygons.length;
    debug.respectPlaneKeys = respectPlaneKeys;
    const outputPolygons = polygons.flatMap((polygon) => {
      const splitLines = boundaryLines
        .filter(
          (line) =>
            !respectPlaneKeys ||
            doesBoundaryApplyToExportPlane(
              line,
              polygon.planeNormal,
              polygon.planePoint,
            ),
        )
        .map((line) => ({
          start: { x: Number(line.x1), y: Number(line.y1) },
          end: { x: Number(line.x2), y: Number(line.y2) },
        }))
        .filter((line) => distanceSquared2D(line.start, line.end) > 1e-6);
      if (!splitLines.length) {
        debug.polygonWithoutApplicableBoundaryCount += 1;
        return [polygon];
      }
      debug.polygonWithApplicableBoundaryCount += 1;

      let pieces = [
        polygon.points2d ??
          polygon.points.split(" ").map((entry) => {
            const [x, y] = entry.split(",").map(Number);
            return { x, y };
          }),
      ];
      splitLines.forEach((line) => {
        pieces = pieces.flatMap((piece) => {
          debug.lineApplicationCount += 1;
          const splitPieces = splitConvexPolygonByLineSegment(piece, line);
          if (splitPieces.length > 1) {
            debug.lineSplitSuccessCount += 1;
          } else {
            debug.lineSplitNoEffectCount += 1;
          }
          return splitPieces;
        });
      });
      return pieces
        .map((piece) => ({
          ...polygon,
          points2d: normalizeSplitPolygonPoints(piece, debug),
        }))
        .filter((piece) => piece.points2d.length >= 3)
        .map((piece) => ({
          ...piece,
          sortDepth: computeExportPolygonRepresentativeDepth(
            piece.points2d,
            piece.sortDepth,
          ),
          backSortDepth: computeExportPolygonBackDepth(
            piece.points2d,
            piece.backSortDepth ?? piece.sortDepth,
          ),
          points: piece.points2d
            .map((point) => `${point.x},${point.y}`)
            .join(" "),
        }));
    });
    debug.outputPolygonCount = outputPolygons.length;
    return {
      polygons: outputPolygons,
      debug,
    };
  }

  /** 不透明時だけ、完全に隠れている polygon を export 対象から除外する。 */
  function removeFullyOccludedExportPolygons(
    polygons: {
      points2d?: { x: number; y: number; cameraZ?: number }[];
    }[],
    opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[],
  ) {
    if (!polygons.length || !opaqueTriangles.length) {
      return polygons;
    }
    return polygons.filter((polygon) => {
      const points = polygon.points2d ?? [];
      if (
        !points.length ||
        points.some((point) => !Number.isFinite(point.cameraZ))
      ) {
        return true;
      }
      const centroid = {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      };
      const closestDepth = context.getClosestOpaqueTriangleDepth(
        centroid,
        opaqueTriangles,
      );
      const centroidCameraZ =
        points.reduce((sum, point) => sum + Number(point.cameraZ), 0) /
        points.length;
      return !(
        Number.isFinite(closestDepth) && closestDepth > centroidCameraZ + 0.002
      );
    });
  }

  /** 不透明 SVG export 用に、共有面の重なり部分だけを polygon 化する。 */
  function collectSolidSharedFaceExportPolygons(
    visibleCrystalEntries: PreviewExportGeometryVisibleCrystalEntryLike[],
    width: number,
    height: number,
    surface: PreviewExportGeometrySurfaceLike,
  ) {
    const polygons: {
      points: string;
      fill: string;
      fillOpacity: number;
      sortDepth: number;
    }[] = [];
    const seen = new Set<string>();
    const rootMatrix = surface?.rootMatrix;
    const occlusionMesh = context.buildPreviewExportOcclusionMesh(surface);
    const planeTolerance = 1e-4;
    const areaTolerance = 1e-3;
    if (!rootMatrix) {
      return polygons;
    }

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
        const mixedColor = context.averageColors([
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
            const { tangent, bitangent } =
              context.buildPlaneBasis(referenceNormal);
            const leftPolygon = ensureCounterClockwise(
              context.projectFaceVerticesToPlane(
                leftFace.vertices,
                origin,
                tangent,
                bitangent,
              ),
            );
            const rightPolygon = ensureCounterClockwise(
              context.projectFaceVerticesToPlane(
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

            const worldPoints = overlapVertices.map((vertex) =>
              vertex.clone().applyMatrix4(rootMatrix),
            );
            const visibilitySamples = [
              worldPoints[0]
                .clone()
                .add(worldPoints[1])
                .add(worldPoints[2])
                .multiplyScalar(1 / 3),
              worldPoints[0]
                .clone()
                .multiplyScalar(2)
                .add(worldPoints[1])
                .add(worldPoints[2])
                .multiplyScalar(1 / 4),
              worldPoints[0]
                .clone()
                .add(worldPoints[1].clone().multiplyScalar(2))
                .add(worldPoints[2])
                .multiplyScalar(1 / 4),
              worldPoints[0]
                .clone()
                .add(worldPoints[1])
                .add(worldPoints[2].clone().multiplyScalar(2))
                .multiplyScalar(1 / 4),
            ];
            const hasVisibleSample = visibilitySamples.some((samplePoint) =>
              context.isWorldLinePointVisibleForExport(
                samplePoint,
                surface,
                occlusionMesh,
                5e-4,
              ),
            );
            if (!hasVisibleSample) {
              continue;
            }
            const projectedPoints = worldPoints.map((point) =>
              context.projectWorldPointToExport(point, width, height),
            );
            let fill = `#${mixedColor.getHexString()}`;
            if (surface.applyLighting) {
              fill = context.applyPreviewLightingToSvgFill(
                fill,
                referenceNormal,
                surface.lightingContext,
              );
            }
            polygons.push({
              points: projectedPoints
                .map((point) => `${point.x},${point.y}`)
                .join(" "),
              fill,
              fillOpacity: 1,
              sortDepth:
                projectedPoints.reduce((sum, point) => sum + point.cameraZ, 0) /
                projectedPoints.length,
            });
          }
        }
      }
    }

    polygons.sort((left, right) => left.sortDepth - right.sortDepth);
    return polygons;
  }

  /**
   * preview body を SVG polygon/path 群へ変換し、必要なら debug 情報も組み立てる。
   *
   * 半透明時は boundary split と局所 overlap sort、不透明時は merge 経路というように
   * 表示モードごとの主分岐をここへ集約する。
   */
  function collectPreviewExportPolygons(
    width: number,
    height: number,
    surface: PreviewExportGeometrySurfaceLike,
    { mergeFaces = true }: { mergeFaces?: boolean } = {},
  ) {
    const polygons: {
      points: string;
      fill: string;
      fillOpacity: number;
      stroke?: string;
      strokeOpacity?: number;
      strokeWidth?: number;
      sortDepth: number;
      backSortDepth?: number;
      points2d?: { x: number; y: number; cameraZ?: number }[];
      planeNormal?: THREE.Vector3;
      planePoint?: THREE.Vector3;
      [key: string]: unknown;
    }[] = [];
    const paths: {
      d: string;
      fill: string;
      fillOpacity: number;
      sortDepth: number;
      backSortDepth?: number;
    }[] = [];
    let opaqueTriangles: {
      p1: { x: number; y: number; cameraZ: number };
      p2: { x: number; y: number; cameraZ: number };
      p3: { x: number; y: number; cameraZ: number };
    }[] = [];
    const helperPolygons: {
      points: string;
      fill: string;
      fillOpacity: number;
      sortDepth: number;
    }[] = [];
    let triangleEntries: {
      worldPoints: THREE.Vector3[];
      projectedPoints: { x: number; y: number; cameraZ: number }[];
      normal: THREE.Vector3;
      fill: string;
      fillOpacity: number;
    }[] = [];
    let rawTrianglePolygons: typeof polygons = [];
    const debugLog: {
      schema: string;
      exportSize: { width: number; height: number };
      vectorBody: boolean;
      mergeFaces: boolean;
      stages: Record<string, unknown>;
      abortReason?: string;
      mode?: string;
      final?: unknown;
    } = {
      schema: "twin-svg-export-debug-v1",
      exportSize: { width, height },
      vectorBody: true,
      mergeFaces,
      stages: {} as Record<string, unknown>,
    };
    const useDirectTransparentXrayTriangles =
      context.isXrayFaceDisplayMode() && surface?.fillOpacity < 0.999;

    if (
      !context.state.previewRoot ||
      (!surface?.geometry && !useDirectTransparentXrayTriangles)
    ) {
      debugLog.vectorBody = false;
      (debugLog as { abortReason?: string }).abortReason =
        "missing-preview-root-or-surface-geometry";
      return { polygons, paths, opaqueTriangles, helperPolygons, debugLog };
    }

    context.state.previewRoot.updateMatrixWorld(true);
    context.camera.updateMatrixWorld(true);
    context.camera.updateProjectionMatrix();
    surface.colorResolver ??= context.createPreviewExportColorResolver(
      width,
      height,
    );
    const visibleCrystalEntries = context.getVisibleCrystalEntriesForExport();
    const faceProfile = resolveTwinPreviewFaceProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings?.customFaceProfile,
    );
    const hasPenetrationTwin = visibleCrystalEntries.some(
      ({ crystal, index }) => index > 0 && crystal?.twinType === "penetration",
    );
    if (
      faceProfile.allowSharedSolidFaceOverlay &&
      hasPenetrationTwin &&
      visibleCrystalEntries.length > 1
    ) {
      helperPolygons.push(
        ...collectSolidSharedFaceExportPolygons(
          visibleCrystalEntries,
          width,
          height,
          surface,
        ),
      );
    }

    if (useDirectTransparentXrayTriangles) {
      const directTriangles = context.collectTransparentXrayExportTriangles(
        width,
        height,
        context.state.previewRoot.matrixWorld,
      );
      triangleEntries = directTriangles.triangleEntries;
      rawTrianglePolygons = directTriangles.rawTrianglePolygons;
      opaqueTriangles = directTriangles.opaqueTriangles;
      debugLog.stages.surface = {
        sourceMode: "xray-direct-face-triangles",
        includeBackFacingTriangles: true,
        fillOpacity: surface.fillOpacity,
        inputTriangleCount: triangleEntries.length,
      };
    } else {
      const rootMatrix = surface.rootMatrix;
      const cameraDirection = context.camera.getWorldDirection(
        new THREE.Vector3(),
      );
      const positionAttribute = surface.geometry?.getAttribute("position");
      const colorAttribute = surface.geometry?.getAttribute(
        "color",
      ) as THREE.BufferAttribute | null;
      if (
        !positionAttribute ||
        !(positionAttribute instanceof THREE.BufferAttribute)
      ) {
        debugLog.vectorBody = false;
        (debugLog as { abortReason?: string }).abortReason =
          "missing-position-attribute";
        return { polygons, paths, opaqueTriangles, helperPolygons, debugLog };
      }

      const triangleCount = Math.floor(positionAttribute.count / 3);
      debugLog.stages.surface = {
        sourceMode: surface.sourceMode ?? "unknown",
        includeBackFacingTriangles: surface.includeBackFacingTriangles === true,
        fillOpacity: surface.fillOpacity,
        inputTriangleCount: triangleCount,
      };
      for (
        let triangleIndex = 0;
        triangleIndex < triangleCount;
        triangleIndex += 1
      ) {
        const triangleStart = triangleIndex * 3;
        const localPoints = [
          new THREE.Vector3(
            positionAttribute.getX(triangleStart),
            positionAttribute.getY(triangleStart),
            positionAttribute.getZ(triangleStart),
          ),
          new THREE.Vector3(
            positionAttribute.getX(triangleStart + 1),
            positionAttribute.getY(triangleStart + 1),
            positionAttribute.getZ(triangleStart + 1),
          ),
          new THREE.Vector3(
            positionAttribute.getX(triangleStart + 2),
            positionAttribute.getY(triangleStart + 2),
            positionAttribute.getZ(triangleStart + 2),
          ),
        ];
        const worldPoints = localPoints.map((point) =>
          point.clone().applyMatrix4(rootMatrix ?? new THREE.Matrix4()),
        );
        const worldNormal = worldPoints[1]
          .clone()
          .sub(worldPoints[0])
          .cross(worldPoints[2].clone().sub(worldPoints[0]))
          .normalize();
        if (
          worldNormal.lengthSq() === 0 ||
          (!surface.includeBackFacingTriangles &&
            worldNormal.dot(cameraDirection) >= -0.0001)
        ) {
          continue;
        }
        const projectedPoints = worldPoints.map((point) =>
          context.projectWorldPointToExport(point, width, height),
        );
        const fill = getTriangleExportFill(
          surface,
          colorAttribute,
          triangleStart,
          projectedPoints,
          worldPoints,
          worldNormal,
        );
        triangleEntries.push({
          worldPoints,
          projectedPoints,
          normal: worldNormal,
          fill,
          fillOpacity: surface.fillOpacity,
        });
        rawTrianglePolygons.push({
          points2d: projectedPoints.map((point) => ({
            x: point.x,
            y: point.y,
            cameraZ: point.cameraZ,
          })),
          points: projectedPoints
            .map((point) => `${point.x},${point.y}`)
            .join(" "),
          fill,
          fillOpacity: surface.fillOpacity,
          stroke: fill,
          strokeOpacity: surface.fillOpacity,
          strokeWidth: 0,
          sortDepth:
            projectedPoints.reduce((sum, point) => sum + point.cameraZ, 0) /
            projectedPoints.length,
          backSortDepth: Math.min(
            ...projectedPoints.map((point) => point.cameraZ),
          ),
        });
        opaqueTriangles.push({
          p1: projectedPoints[0],
          p2: projectedPoints[1],
          p3: projectedPoints[2],
        });
      }
    }
    debugLog.stages.collectTriangles = {
      rawTrianglePolygonCount: rawTrianglePolygons.length,
      triangleEntryCount: triangleEntries.length,
      opaqueTriangleCount: opaqueTriangles.length,
      helperPolygonCount: helperPolygons.length,
    };

    if (mergeFaces) {
      try {
        paths.push(
          ...buildMergedExportPaths(
            triangleEntries,
            width,
            height,
            collectBlockingExportEdgeKeys({
              previewRoot: context.state.previewRoot,
              hasNamedAncestor: context.hasNamedAncestor,
            }),
            {
              buildPlaneBasis: context.buildPlaneBasis,
              projectFaceVerticesToPlane: context.projectFaceVerticesToPlane,
              projectWorldPointToExport: context.projectWorldPointToExport,
            },
          ),
        );
        debugLog.mode = "plane-path-merge";
        debugLog.stages.planePathMerge = {
          pathCount: paths.length,
          fallbackPolygonCount: polygons.length,
        };
      } catch (error) {
        console.warn(
          "[Twin SVG] face merge failed, falling back to triangles",
          {
            message: error instanceof Error ? error.message : String(error),
            triangleCount: triangleEntries.length,
          },
        );
        polygons.push(...rawTrianglePolygons);
        debugLog.mode = "plane-path-merge-fallback";
        debugLog.stages.planePathMerge = {
          error: error instanceof Error ? error.message : String(error),
          fallbackPolygonCount: polygons.length,
        };
      }
    } else {
      const { width: workWidth, height: workHeight } = getVectorSvgBodyWorkSize(
        context.svgVectorBodyWorkLongEdge,
        width,
        height,
      );
      const workPolygons =
        workWidth === width && workHeight === height
          ? rawTrianglePolygons
          : rawTrianglePolygons.map((polygon) =>
              scaleExportPolygonCoordinates(
                polygon,
                workWidth / width,
                workHeight / height,
              ),
            );
      const workOpaqueTriangles =
        workWidth === width && workHeight === height
          ? opaqueTriangles
          : scaleOpaqueExportTriangles(
              opaqueTriangles,
              workWidth / width,
              workHeight / height,
            );
      const useAllBoundarySplit = surface.fillOpacity < 0.999;
      const boundarySource = useAllBoundarySplit
        ? collectAllBoundaryExportLinesForTriangleSplit(workWidth, workHeight)
        : {
            lines: collectVisibleBoundaryExportLinesForTriangleSplit(
              workWidth,
              workHeight,
              workOpaqueTriangles,
              surface,
            ),
            debug: null,
          };
      const boundaryLines = boundarySource.lines;
      const respectPlaneKeys = !useAllBoundarySplit;
      const splitResult = splitTriangleExportPolygonsByBoundaryLines(
        workPolygons,
        boundaryLines,
        {
          respectPlaneKeys,
        },
      );
      const splitPolygons = splitResult.polygons;
      const visibleSplitPolygons =
        surface.fillOpacity < 0.999
          ? splitPolygons
          : removeFullyOccludedExportPolygons(
              splitPolygons,
              workOpaqueTriangles,
            );
      const scaleX = width / workWidth;
      const scaleY = height / workHeight;
      const usePairwiseMerge = surface.fillOpacity >= 0.999;
      const merged = usePairwiseMerge
        ? mergeAdjacentSplitPolygonsByFill(visibleSplitPolygons, boundaryLines)
        : {
            polygons: visibleSplitPolygons,
            paths: [],
            debug: { skippedForTransparency: true },
          };
      const finalPolygons = merged.polygons.map((polygon) =>
        scaleExportPolygonCoordinates(polygon, scaleX, scaleY),
      );
      const finalBoundaryLines = boundaryLines.map((line) => ({
        ...line,
        x1: Number(line.x1) * scaleX,
        y1: Number(line.y1) * scaleY,
        x2: Number(line.x2) * scaleX,
        y2: Number(line.y2) * scaleY,
      }));
      polygons.push(...finalPolygons);
      paths.push(
        ...merged.paths.map((path) =>
          scaleExportPathCoordinates(path, scaleX, scaleY),
        ),
      );
      debugLog.mode = "boundary-split-pairwise-polygon-merge";
      debugLog.stages.boundarySplit = {
        workSize: { width: workWidth, height: workHeight },
        scaleToExport: { x: scaleX, y: scaleY },
        boundaryMode: useAllBoundarySplit
          ? "all-ridges-and-intersections"
          : "visible-boundary-lines",
        boundaryLineCount: boundaryLines.length,
        boundarySource: boundarySource.debug,
        workPolygonCount: workPolygons.length,
        splitPolygonCount: splitPolygons.length,
        visibleSplitPolygonCount: visibleSplitPolygons.length,
        splitDebug: splitResult.debug,
        sortDepthStrategy:
          surface.fillOpacity < 0.999
            ? "frontmost-cameraZ-then-backmost-cameraZ"
            : "legacy",
        pairwiseMergeEnabled: usePairwiseMerge,
        mergedPolygonCount: merged.polygons.length,
        finalPolygonCount: finalPolygons.length,
        merge: merged.debug ?? null,
      };
      debugLog.stages.boundaryCrossingCheck = buildBoundaryCrossingPolygonDebug(
        finalPolygons,
        finalBoundaryLines,
        {
          label: "applied-boundaries",
          respectPlaneKeys,
        },
      );
      debugLog.stages.boundaryCrossingCheckAll =
        buildBoundaryCrossingPolygonDebug(finalPolygons, finalBoundaryLines, {
          label: "all-boundaries",
          respectPlaneKeys: false,
        });
      debugLog.stages.finalEdgeSummary = buildTwinSvgEdgeDebugSummary(
        finalPolygons.map((polygon) => createTwinSvgMergeFace(polygon, [])),
      );
    }
    paths.sort(
      (left, right) =>
        left.sortDepth - right.sortDepth ||
        (left.backSortDepth ?? left.sortDepth) -
          (right.backSortDepth ?? right.sortDepth),
    );
    polygons.sort(
      (left, right) =>
        left.sortDepth - right.sortDepth ||
        (left.backSortDepth ?? left.sortDepth) -
          (right.backSortDepth ?? right.sortDepth),
    );
    if (surface.fillOpacity < 0.999) {
      const localOverlapSort = applyLocalOverlapDepthSort(polygons);
      polygons.splice(0, polygons.length, ...localOverlapSort.polygons);
      debugLog.stages.localOverlapSort = localOverlapSort.debug;
    }
    debugLog.final = {
      polygonCount: polygons.length,
      pathCount: paths.length,
      helperPolygonCount: helperPolygons.length,
      faces: buildSvgExportFaceDebugList(polygons, paths),
      sortTieSummary: buildSvgSortTieDebugSummary([...polygons, ...paths]),
    };
    return { polygons, paths, opaqueTriangles, helperPolygons, debugLog };
  }

  return {
    collectPreviewExportLines,
    collectPreviewExportPolygons,
  };
}
