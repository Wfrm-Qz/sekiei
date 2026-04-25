import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTwinPreviewExportSurfaceActions } from "../../../src/export/previewExportSurface.ts";

/**
 * export/previewExportSurface の公開 helper を確認する smoke unit test。
 */
describe("export/previewExportSurface", () => {
  function createContext() {
    return {
      state: {
        parameters: { crystalSystem: "cubic" },
        buildResult: null,
        previewRoot: null,
        faceDisplayMode: "solid",
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewAmbientLight: new THREE.AmbientLight(),
      previewKeyLight: new THREE.DirectionalLight(),
      previewFillLight: new THREE.DirectionalLight(),
      buildPreviewBoundsSphere: vi.fn(() => ({ radius: 1 })),
      getVisibleCrystalEntriesForExport: vi.fn(() => []),
      getTwinCrystals: vi.fn(() => []),
      getTwinCrystalFaces: vi.fn(() => []),
      buildTwinFaceGroupPalette: vi.fn(() => ({
        faceColors: new Map(),
        groupColors: new Map(),
      })),
      getCrystalAccentColor: vi.fn(() => "#ffffff"),
      buildDisplayGeometry: vi.fn(() => null),
      buildFlatFaceColors: vi.fn(() => []),
      projectWorldPointToExport: vi.fn(() => ({
        x: 0,
        y: 0,
        projectedZ: 0,
        cameraZ: 0,
      })),
      getExportMaterial: vi.fn(() => null),
      hasNamedAncestor: vi.fn(() => false),
      resolveXrayPreviewFaceColor: vi.fn(() => "#ffffff"),
      isXrayFaceDisplayMode: vi.fn(() => false),
    };
  }

  it("正常系として surface actions は公開 helper 群を返す", () => {
    const actions = createTwinPreviewExportSurfaceActions(createContext());

    expect(typeof actions.getExportSurfaceData).toBe("function");
    expect(typeof actions.collectTransparentXrayExportTriangles).toBe(
      "function",
    );
  });

  it("異常系寄りとして geometry が無い状態では export surface は null を返す", () => {
    const actions = createTwinPreviewExportSurfaceActions(createContext());

    expect(actions.getExportSurfaceData()).toBeNull();
    expect(actions.shouldUseVectorCrystalBodyForSvgExport()).toBe(false);
  });
});
