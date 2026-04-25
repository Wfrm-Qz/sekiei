import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createTwinPreviewExportGeometryActions } from "../../../src/export/previewExportGeometry.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";

/**
 * preview export geometry 分離後の主要契約を守る integration test。
 *
 * ここでは pure helper 単体ではなく、`createTwinPreviewExportGeometryActions`
 * に最低限の context を渡して、polygon / line 生成の大枠が崩れていないことを
 * 固定する。
 */

function hasNamedAncestor(object: THREE.Object3D | null, name: string) {
  let current: THREE.Object3D | null = object?.parent ?? null;
  while (current) {
    if (current.name === name) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

function createProjectWorldPointToExport() {
  return (worldPoint: THREE.Vector3) => ({
    x: worldPoint.x,
    y: worldPoint.y,
    projectedZ: worldPoint.z,
    cameraZ: worldPoint.z,
  });
}

function createBaseContext(overrides: Record<string, unknown> = {}) {
  const previewRoot = new THREE.Group();
  previewRoot.name = "preview-root";
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
  camera.position.set(0, 0, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  const context = {
    state: {
      parameters: { crystalSystem: "cubic" },
      previewRoot,
      ridgeLines: null,
      intersectionRidgeLines: null,
      faceDisplayMode: "solid",
    },
    camera,
    svgVectorBodyWorkLongEdge: 100,
    getVisibleCrystalEntriesForExport: () => [],
    projectWorldPointToExport: createProjectWorldPointToExport(),
    hasNamedAncestor,
    getExportMaterial: (object: THREE.Object3D & { material?: unknown }) =>
      object.material,
    collectVisibleWorldLineSegments: (
      startPoint: THREE.Vector3,
      endPoint: THREE.Vector3,
    ) => [
      {
        x1: startPoint.x,
        y1: startPoint.y,
        x2: endPoint.x,
        y2: endPoint.y,
      },
    ],
    buildPreviewExportOcclusionMesh: () => null,
    isWorldLinePointVisibleForExport: () => true,
    getClosestOpaqueTriangleDepth: () => Number.NEGATIVE_INFINITY,
    isXrayFaceDisplayMode: () => false,
    createPreviewExportColorResolver: () => null,
    applyPreviewLightingToSvgFill: (fill: string) => fill,
    collectTransparentXrayExportTriangles: () => ({
      triangleEntries: [],
      rawTrianglePolygons: [],
      opaqueTriangles: [],
    }),
    getCrystalAccentColor: () => "#d35b53",
    averageColors: (colors: THREE.Color[]) => {
      const color = new THREE.Color(0, 0, 0);
      colors.forEach((entry) => color.add(entry));
      return color.multiplyScalar(1 / Math.max(colors.length, 1));
    },
    buildPlaneBasis: (normal: THREE.Vector3) => {
      const tangent = new THREE.Vector3(1, 0, 0);
      if (Math.abs(normal.dot(tangent)) > 0.999) {
        tangent.set(0, 1, 0);
      }
      tangent.cross(normal).normalize();
      const bitangent = normal.clone().cross(tangent).normalize();
      return { tangent, bitangent };
    },
    projectFaceVerticesToPlane: (
      vertices: { x: number; y: number; z: number }[],
      origin: THREE.Vector3,
      tangent: THREE.Vector3,
      bitangent: THREE.Vector3,
    ) =>
      vertices.map((vertex) => {
        const world = new THREE.Vector3(vertex.x, vertex.y, vertex.z);
        const relative = world.sub(origin);
        return {
          x: relative.dot(tangent),
          y: relative.dot(bitangent),
        };
      }),
    buildCrossCrystalIntersectionLinePositions: () => [],
    buildIntersectionSegments: () => [],
    collectRidgeSplitParameters: () => [],
    buildOutlineSegmentKey: (start: THREE.Vector3, end: THREE.Vector3) =>
      `${start.toArray().join(",")}::${end.toArray().join(",")}`,
    buildIntersectionLinePoint: () => null,
    clipLineToConvexFace: () => null,
    ...overrides,
  };

  return {
    context,
    previewRoot,
    camera,
  };
}

describe("export/previewExportGeometry integration", () => {
  it("preview line object から SVG line を生成できる", () => {
    const { context, previewRoot } = createBaseContext();
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 40, 0, 0], 3),
      ),
      new THREE.LineBasicMaterial({
        color: "#ff0000",
        linewidth: 2,
      }),
    );
    previewRoot.add(line);
    previewRoot.updateMatrixWorld(true);

    const actions = createTwinPreviewExportGeometryActions(context as never);
    const lines = actions.collectPreviewExportLines(100, 100, [], null);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      stroke: "#ff0000",
      strokeWidth: 2,
      x1: 0,
      y1: 0,
      x2: 40,
      y2: 0,
    });
  });

  it("xray hidden 線 export では surface と occludedInterior に別 style を適用できる", () => {
    const { context, previewRoot } = createBaseContext({
      state: {
        parameters: { crystalSystem: "cubic" },
        previewRoot: null,
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceDisplayMode: "xray-solid",
      },
    });
    context.state.previewRoot = previewRoot;
    const ridgeRoot = new THREE.Group();
    ridgeRoot.name = "preview-ridge-lines";

    const makeHiddenLine = (
      segmentKind: "surface" | "occludedInterior",
      y: number,
    ) => {
      const holder = new THREE.Group();
      holder.userData.previewRidgeSegmentKind = segmentKind;
      const line = new THREE.LineSegments(
        new THREE.BufferGeometry().setAttribute(
          "position",
          new THREE.Float32BufferAttribute([0, y, 0, 40, y, 0], 3),
        ),
        new THREE.LineBasicMaterial({
          color: "#181818",
          transparent: true,
          opacity: 1,
          linewidth: 2,
        }),
      );
      line.userData.previewLineLayer = "hidden";
      holder.add(line);
      return holder;
    };

    ridgeRoot.add(makeHiddenLine("surface", 0));
    ridgeRoot.add(makeHiddenLine("occludedInterior", 10));
    previewRoot.add(ridgeRoot);
    previewRoot.updateMatrixWorld(true);
    context.state.ridgeLines = ridgeRoot;

    const actions = createTwinPreviewExportGeometryActions(context as never);
    const lines = actions.collectPreviewExportLines(100, 100, [], null);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({
      strokeOpacity: 0.82,
      strokeWidth: 2,
    });
    expect(lines[1]).toMatchObject({
      strokeOpacity: 0.42,
      strokeWidth: 1.44,
    });
    expect(lines[0].stroke).not.toBe("#181818");
    expect(lines[1].stroke).not.toBe("#181818");
  });

  it("xray hidden 線 export では custom color mode も使える", () => {
    const previewStyleSettings = createDefaultTwinPreviewStyleSettings();
    previewStyleSettings.customLineProfile.hiddenSurfaceLineColorMode =
      "custom";
    previewStyleSettings.customLineProfile.hiddenSurfaceLineCustomColor =
      "#123456";
    const { context, previewRoot } = createBaseContext({
      state: {
        parameters: { crystalSystem: "cubic" },
        previewRoot: null,
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceDisplayMode: "custom",
        previewStyleSettings,
      },
    });
    context.state.previewRoot = previewRoot;
    const ridgeRoot = new THREE.Group();
    ridgeRoot.name = "preview-ridge-lines";
    ridgeRoot.userData.previewRidgeSegmentKind = "surface";
    const line = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute([0, 0, 0, 40, 0, 0], 3),
      ),
      new THREE.LineBasicMaterial({
        color: "#181818",
        transparent: true,
        opacity: 1,
        linewidth: 2,
      }),
    );
    line.userData.previewLineLayer = "hidden";
    ridgeRoot.add(line);
    previewRoot.add(ridgeRoot);
    previewRoot.updateMatrixWorld(true);
    context.state.ridgeLines = ridgeRoot;

    const actions = createTwinPreviewExportGeometryActions(context as never);
    const lines = actions.collectPreviewExportLines(100, 100, [], null);

    expect(lines).toHaveLength(1);
    expect(lines[0].stroke).toBe("#123456");
  });

  it("visible boundary line で opaque polygon を split できる", () => {
    const { context, previewRoot } = createBaseContext();
    const ridgeLines = new THREE.Group();
    ridgeLines.name = "preview-ridge-lines";
    ridgeLines.visible = false;
    const boundary = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.Float32BufferAttribute([10, -10, 0, 10, 30, 0], 3),
      ),
      new THREE.LineBasicMaterial({
        color: "#000000",
        linewidth: 1,
        depthTest: false,
      }),
    );
    ridgeLines.add(boundary);
    previewRoot.add(ridgeLines);
    previewRoot.updateMatrixWorld(true);
    context.state.ridgeLines = ridgeLines;

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 40, 0, 0, 0, 40, 0], 3),
    );

    const actions = createTwinPreviewExportGeometryActions(context as never);
    const result = actions.collectPreviewExportPolygons(
      100,
      100,
      {
        geometry,
        rootMatrix: new THREE.Matrix4(),
        fillOpacity: 1,
        fillColor: "#d35b53",
        applyLighting: false,
        includeBackFacingTriangles: false,
      },
      { mergeFaces: false },
    );

    expect(result.debugLog.mode).toBe("boundary-split-pairwise-polygon-merge");
    expect(
      (
        result.debugLog.stages.boundarySplit as {
          boundaryLineCount: number;
          splitPolygonCount: number;
          workPolygonCount: number;
          splitDebug: { lineSplitSuccessCount: number };
        }
      ).boundaryLineCount,
    ).toBeGreaterThan(0);
    expect(
      (
        result.debugLog.stages.boundarySplit as {
          splitPolygonCount: number;
          workPolygonCount: number;
        }
      ).splitPolygonCount,
    ).toBeGreaterThan(
      (
        result.debugLog.stages.boundarySplit as {
          splitPolygonCount: number;
          workPolygonCount: number;
        }
      ).workPolygonCount,
    );
    expect(
      (
        result.debugLog.stages.boundarySplit as {
          splitDebug: { lineSplitSuccessCount: number };
        }
      ).splitDebug.lineSplitSuccessCount,
    ).toBeGreaterThan(0);
    expect(
      (
        result.debugLog.stages.boundaryCrossingCheck as {
          crossingPolygonCount: number;
        }
      ).crossingPolygonCount,
    ).toBe(0);
  });

  it("半透明 xray export では localOverlapSort の debug を残す", () => {
    const { context } = createBaseContext({
      state: {
        parameters: { crystalSystem: "cubic" },
        previewRoot: new THREE.Group(),
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceDisplayMode: "xray-grouped",
      },
      isXrayFaceDisplayMode: () => true,
      collectTransparentXrayExportTriangles: () => ({
        triangleEntries: [
          {
            worldPoints: [
              new THREE.Vector3(0, 0, 0),
              new THREE.Vector3(20, 0, 0),
              new THREE.Vector3(0, 20, 0),
            ],
            projectedPoints: [
              { x: 0, y: 0, cameraZ: -2 },
              { x: 20, y: 0, cameraZ: -2 },
              { x: 0, y: 20, cameraZ: -2 },
            ],
            normal: new THREE.Vector3(0, 0, 1),
            fill: "#d35b53",
            fillOpacity: 0.5,
          },
          {
            worldPoints: [
              new THREE.Vector3(5, 0, 0),
              new THREE.Vector3(25, 0, 0),
              new THREE.Vector3(5, 20, 0),
            ],
            projectedPoints: [
              { x: 5, y: 0, cameraZ: -1 },
              { x: 25, y: 0, cameraZ: -1 },
              { x: 5, y: 20, cameraZ: -1 },
            ],
            normal: new THREE.Vector3(0, 0, 1),
            fill: "#4e77d8",
            fillOpacity: 0.5,
          },
        ],
        rawTrianglePolygons: [
          {
            points2d: [
              { x: 0, y: 0, cameraZ: -2 },
              { x: 20, y: 0, cameraZ: -2 },
              { x: 0, y: 20, cameraZ: -2 },
            ],
            points: "0,0 20,0 0,20",
            fill: "#d35b53",
            fillOpacity: 0.5,
            stroke: "#d35b53",
            strokeOpacity: 0.5,
            strokeWidth: 0,
            sortDepth: -2,
            backSortDepth: -2,
          },
          {
            points2d: [
              { x: 5, y: 0, cameraZ: -1 },
              { x: 25, y: 0, cameraZ: -1 },
              { x: 5, y: 20, cameraZ: -1 },
            ],
            points: "5,0 25,0 5,20",
            fill: "#4e77d8",
            fillOpacity: 0.5,
            stroke: "#4e77d8",
            strokeOpacity: 0.5,
            strokeWidth: 0,
            sortDepth: -1,
            backSortDepth: -1,
          },
        ],
        opaqueTriangles: [],
      }),
    });
    context.state.previewRoot.updateMatrixWorld(true);

    const actions = createTwinPreviewExportGeometryActions(context as never);
    const result = actions.collectPreviewExportPolygons(
      100,
      100,
      {
        fillOpacity: 0.5,
        rootMatrix: new THREE.Matrix4(),
        fillColor: "#d35b53",
        applyLighting: false,
        includeBackFacingTriangles: true,
        sourceMode: "xray-direct-face-triangles",
      },
      { mergeFaces: false },
    );

    expect(result.polygons).toHaveLength(2);
    expect(result.debugLog.mode).toBe("boundary-split-pairwise-polygon-merge");
    expect(
      (
        result.debugLog.stages.localOverlapSort as {
          overlapPairCount: number;
          decisivePairCount: number;
        }
      ).overlapPairCount,
    ).toBeGreaterThan(0);
    expect(
      (
        result.debugLog.stages.localOverlapSort as {
          overlapPairCount: number;
          decisivePairCount: number;
        }
      ).decisivePairCount,
    ).toBeGreaterThan(0);
  });
});
