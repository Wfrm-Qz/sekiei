import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { averageColors } from "../../../src/export/previewExportSurfaceProfiles.ts";
import {
  applyPreviewLightingToSvgFill,
  buildPreviewSvgLightingContext,
  createPreviewExportColorResolver,
  getApproximateMultiCrystalExportColor,
  getRenderablePreviewMeshesForExport,
} from "../../../src/export/previewExportSurfaceRendering.ts";

describe("export/previewExportSurfaceRendering", () => {
  it("lighting context は visible な ambient / directional を集約する", () => {
    const ambient = new THREE.AmbientLight("#ffffff", 0.4);
    const key = new THREE.DirectionalLight("#ffffff", 0.8);
    const fill = new THREE.DirectionalLight("#ffffff", 0.3);
    key.position.set(1, 0, 0);
    fill.visible = false;

    const lighting = buildPreviewSvgLightingContext({
      previewAmbientLight: ambient,
      previewKeyLight: key,
      previewFillLight: fill,
    });

    expect(lighting.ambient?.intensity).toBeCloseTo(0.4, 6);
    expect(lighting.directionals).toHaveLength(1);
    expect(lighting.normalization).toBeCloseTo(1.2, 6);
  });

  it("applyPreviewLightingToSvgFill は world normal に応じて色を変える", () => {
    const ambient = new THREE.AmbientLight("#ffffff", 0.2);
    const key = new THREE.DirectionalLight("#ff0000", 1);
    const fill = new THREE.DirectionalLight("#ffffff", 0);
    key.position.set(0, 0, 1);
    const lighting = buildPreviewSvgLightingContext({
      previewAmbientLight: ambient,
      previewKeyLight: key,
      previewFillLight: fill,
    });

    const lit = applyPreviewLightingToSvgFill(
      "#808080",
      new THREE.Vector3(0, 0, 1),
      lighting,
    );

    expect(lit).toBe("#803535");
  });

  it("renderable mesh 列挙は helper object を除外する", () => {
    const root = new THREE.Group();
    const visibleMesh = new THREE.Mesh(new THREE.BoxGeometry());
    const helperGroup = new THREE.Group();
    helperGroup.name = "preview-ridge-lines";
    const helperMesh = new THREE.Mesh(new THREE.BoxGeometry());
    helperGroup.add(helperMesh);
    root.add(visibleMesh);
    root.add(helperGroup);

    const meshes = getRenderablePreviewMeshesForExport({
      previewRoot: root,
      hasNamedAncestor(object, name) {
        let current: THREE.Object3D | null = object;
        while (current) {
          if (current.name === name) {
            return true;
          }
          current = current.parent;
        }
        return false;
      },
    });

    expect(meshes).toHaveLength(1);
    expect(meshes[0]).toBe(visibleMesh);
  });

  it("複数結晶 export の fallback 色は grouped かどうかで切り替わる", () => {
    const visibleCrystalEntries = [{ index: 0 }, { index: 1 }];
    const grouped = getApproximateMultiCrystalExportColor({
      visibleCrystalEntries,
      faceProfile: { usesFaceGroupPalette: true },
      state: {
        parameters: { crystalSystem: "cubic" },
        previewRoot: null,
      },
      getTwinCrystalFaces: vi.fn(() => [{ id: "a" }]),
      buildTwinFaceGroupPalette: vi.fn(() => ({
        faceColors: new Map(),
        groupColors: new Map([
          ["g1", { preview: "#ff0000" }],
          ["g2", { preview: "#00ff00" }],
        ]),
      })),
      getCrystalAccentColor: vi.fn(() => "#ffffff"),
      averageColors,
    });
    const flat = getApproximateMultiCrystalExportColor({
      visibleCrystalEntries,
      faceProfile: { usesFaceGroupPalette: false },
      state: {
        parameters: { crystalSystem: "cubic" },
        previewRoot: null,
      },
      getTwinCrystalFaces: vi.fn(() => []),
      buildTwinFaceGroupPalette: vi.fn(() => ({
        faceColors: new Map(),
        groupColors: new Map(),
      })),
      getCrystalAccentColor: vi
        .fn()
        .mockReturnValueOnce("#000000")
        .mockReturnValueOnce("#ffffff"),
      averageColors,
    });

    expect(grouped.getHexString()).toBe("bcbc00");
    expect(flat.r).toBeCloseTo(0.5, 6);
  });

  it("color resolver は preview mesh が無ければ null を返す", () => {
    const resolver = createPreviewExportColorResolver({
      width: 100,
      height: 100,
      previewRoot: new THREE.Group(),
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      buildPreviewBoundsSphere: () => ({ radius: 1 }),
      projectWorldPointToExport: () => ({
        x: 0,
        y: 0,
        projectedZ: 0,
        cameraZ: 0,
      }),
      getExportMaterial: () => null,
      hasNamedAncestor: () => false,
    });

    expect(resolver).toBeNull();
  });
});
