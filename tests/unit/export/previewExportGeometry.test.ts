import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTwinPreviewExportGeometryActions } from "../../../src/export/previewExportGeometry.ts";

/**
 * export/previewExportGeometry の公開 factory を確認する smoke unit test。
 */
describe("export/previewExportGeometry", () => {
  function createContext() {
    return {
      state: {
        parameters: { crystalSystem: "cubic" },
        previewRoot: null,
        ridgeLines: null,
        intersectionRidgeLines: null,
        faceDisplayMode: "solid",
      },
      camera: new THREE.PerspectiveCamera(),
      svgVectorBodyWorkLongEdge: 512,
      getVisibleCrystalEntriesForExport: vi.fn(() => []),
      projectWorldPointToExport: vi.fn(() => ({
        x: 0,
        y: 0,
        projectedZ: 0,
        cameraZ: 0,
      })),
      hasNamedAncestor: vi.fn(() => false),
      getExportMaterial: vi.fn(() => null),
      collectVisibleWorldLineSegments: vi.fn(() => []),
      buildPreviewExportOcclusionMesh: vi.fn(() => null),
      isWorldLinePointVisibleForExport: vi.fn(() => true),
      getClosestOpaqueTriangleDepth: vi.fn(() => Number.POSITIVE_INFINITY),
      isXrayFaceDisplayMode: vi.fn(() => false),
      createPreviewExportColorResolver: vi.fn(() => null),
      applyPreviewLightingToSvgFill: vi.fn((fill) => fill),
      collectTransparentXrayExportTriangles: vi.fn(() => ({
        triangleEntries: [],
        rawTrianglePolygons: [],
        opaqueTriangles: [],
      })),
      getCrystalAccentColor: vi.fn(() => "#ffffff"),
      averageColors: vi.fn(() => new THREE.Color("#ffffff")),
      buildPlaneBasis: vi.fn(() => ({
        tangent: new THREE.Vector3(1, 0, 0),
        bitangent: new THREE.Vector3(0, 1, 0),
      })),
      projectFaceVerticesToPlane: vi.fn(() => []),
      buildCrossCrystalIntersectionLinePositions: vi.fn(() => []),
      buildIntersectionSegments: vi.fn(() => []),
      collectRidgeSplitParameters: vi.fn(() => [0, 1]),
      buildOutlineSegmentKey: vi.fn(() => "edge"),
      buildIntersectionLinePoint: vi.fn(() => null),
      clipLineToConvexFace: vi.fn(() => null),
    };
  }

  it("正常系として geometry actions は lines/polygons collector を返す", () => {
    const actions = createTwinPreviewExportGeometryActions(createContext());

    expect(typeof actions.collectPreviewExportLines).toBe("function");
    expect(typeof actions.collectPreviewExportPolygons).toBe("function");
  });

  it("異常系寄りとして previewRoot が無い context でも factory 自体は生成できる", () => {
    expect(() =>
      createTwinPreviewExportGeometryActions(createContext()),
    ).not.toThrow();
  });
});
