import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTwinPreviewExportSurfaceActions } from "../../../src/export/previewExportSurface.ts";

describe("export/previewExportSurface", () => {
  it("visible crystal が 1 件なら vector body を使える", () => {
    const actions = createTwinPreviewExportSurfaceActions({
      state: {
        parameters: { crystalSystem: "cubic" },
        buildResult: { previewFinalGeometry: null, finalGeometry: null },
        previewRoot: new THREE.Group(),
        faceDisplayMode: "solid",
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewAmbientLight: new THREE.AmbientLight(),
      previewKeyLight: new THREE.DirectionalLight(),
      previewFillLight: new THREE.DirectionalLight(),
      buildPreviewBoundsSphere: () => ({ radius: 10 }),
      getVisibleCrystalEntriesForExport: () => [
        { index: 0, crystal: { enabled: true }, meshData: { faces: [] } },
      ],
      getTwinCrystals: () => [{ enabled: true }],
      getTwinCrystalFaces: () => [],
      buildTwinFaceGroupPalette: () => ({
        faceColors: new Map(),
        groupColors: new Map(),
      }),
      getCrystalAccentColor: () => "#ff0000",
      buildDisplayGeometry: () => null,
      buildFlatFaceColors: () => [],
      projectWorldPointToExport: () => ({
        x: 0,
        y: 0,
        projectedZ: 0,
        cameraZ: 0,
      }),
      getExportMaterial: vi.fn(),
      hasNamedAncestor: () => false,
      resolveXrayPreviewFaceColor: () => "#ffffff",
      isXrayFaceDisplayMode: () => false,
    });

    expect(actions.shouldUseVectorCrystalBodyForSvgExport()).toBe(true);
  });

  it("visible crystal が無いと export surface data は作れない", () => {
    const actions = createTwinPreviewExportSurfaceActions({
      state: {
        parameters: { crystalSystem: "cubic" },
        buildResult: null,
        previewRoot: null,
        faceDisplayMode: "grouped",
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewAmbientLight: new THREE.AmbientLight(),
      previewKeyLight: new THREE.DirectionalLight(),
      previewFillLight: new THREE.DirectionalLight(),
      buildPreviewBoundsSphere: () => ({ radius: 10 }),
      getVisibleCrystalEntriesForExport: () => [],
      getTwinCrystals: () => [],
      getTwinCrystalFaces: () => [],
      buildTwinFaceGroupPalette: () => ({
        faceColors: new Map(),
        groupColors: new Map(),
      }),
      getCrystalAccentColor: () => "#ff0000",
      buildDisplayGeometry: () => null,
      buildFlatFaceColors: () => [],
      projectWorldPointToExport: () => ({
        x: 0,
        y: 0,
        projectedZ: 0,
        cameraZ: 0,
      }),
      getExportMaterial: vi.fn(),
      hasNamedAncestor: () => false,
      resolveXrayPreviewFaceColor: () => "#ffffff",
      isXrayFaceDisplayMode: () => false,
    });

    expect(actions.getExportSurfaceData()).toBeNull();
  });

  it("非表示の結晶がある multi-crystal 時は finalGeometry ではなく visible crystal だけで surface を作る", () => {
    const previewRoot = new THREE.Group();
    previewRoot.updateMatrixWorld(true);
    const hiddenAwareGeometry = new THREE.BufferGeometry();
    hiddenAwareGeometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const actions = createTwinPreviewExportSurfaceActions({
      state: {
        parameters: { crystalSystem: "cubic" },
        buildResult: {
          previewFinalGeometry: new THREE.BoxGeometry(2, 2, 2),
          finalGeometry: new THREE.BoxGeometry(2, 2, 2),
          crystalPreviewMeshData: [{ faces: [] }, { faces: [] }, { faces: [] }],
        },
        previewRoot,
        faceDisplayMode: "grouped",
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewAmbientLight: new THREE.AmbientLight(),
      previewKeyLight: new THREE.DirectionalLight(),
      previewFillLight: new THREE.DirectionalLight(),
      buildPreviewBoundsSphere: () => ({ radius: 10 }),
      getVisibleCrystalEntriesForExport: () => [
        { index: 0, crystal: { enabled: true }, meshData: { faces: [] } },
        { index: 1, crystal: { enabled: true }, meshData: { faces: [] } },
      ],
      getTwinCrystals: () => [
        { enabled: true },
        { enabled: true },
        { enabled: true },
      ],
      getTwinCrystalFaces: () => [],
      buildTwinFaceGroupPalette: () => ({
        faceColors: new Map(),
        groupColors: new Map(),
      }),
      getCrystalAccentColor: () => "#ff0000",
      buildDisplayGeometry: vi.fn(() => hiddenAwareGeometry.clone()),
      buildFlatFaceColors: vi.fn(() => []),
      projectWorldPointToExport: () => ({
        x: 0,
        y: 0,
        projectedZ: 0,
        cameraZ: 0,
      }),
      getExportMaterial: vi.fn(),
      hasNamedAncestor: () => false,
      resolveXrayPreviewFaceColor: () => "#ffffff",
      isXrayFaceDisplayMode: () => false,
    });

    const surface = actions.getExportSurfaceData();

    expect(surface?.sourceMode).toBe("visible-crystal-geometries");
    expect(surface?.geometry).not.toBeNull();
  });
});
