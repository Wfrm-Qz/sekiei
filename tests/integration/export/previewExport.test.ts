import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createTwinPreviewExportActions,
  createTwinPreviewExportRuntimeActions,
} from "../../../src/export/previewExport.ts";

describe("export/previewExport", () => {
  it("runtime と action を組み合わせて SVG export を組み立てられる", () => {
    const previewStage = document.createElement("div");
    Object.defineProperty(previewStage, "clientWidth", { value: 320 });
    Object.defineProperty(previewStage, "clientHeight", { value: 180 });
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 180;

    const runtime = createTwinPreviewExportRuntimeActions({
      state: {
        faceDisplayMode: "solid",
        previewRoot: new THREE.Group(),
        buildResult: null,
      },
      elements: {
        previewStage,
        faceLabelLayer: document.createElement("div"),
        presetMetadataName: document.createElement("div"),
        presetMetadataShortDescription: document.createElement("div"),
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      isCrystalVisible: vi.fn(() => true),
      getTwinCrystals: vi.fn(() => []),
    });

    const actions = createTwinPreviewExportActions({
      state: {
        previewRoot: new THREE.Group(),
        ridgeLines: null,
        intersectionRidgeLines: null,
        axisGuideGroup: null,
        twinRuleGuideGroup: null,
      },
      elements: { previewStage, canvas },
      renderer: { render: vi.fn() } as unknown as THREE.WebGLRenderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      requestPreviewRender: vi.fn(),
      hasNamedAncestor: runtime.hasNamedAncestor,
      getExportSurfaceData: vi.fn(() => null),
      collectPreviewExportPolygons: vi.fn(() => ({
        polygons: [],
        paths: [],
        opaqueTriangles: [],
        helperPolygons: [],
        debugLog: { mode: "test" },
      })),
      collectPreviewExportLines: vi.fn(() => []),
      getPreviewTextOverlays: runtime.getPreviewTextOverlays,
      shouldMergeVectorSvgBodyFacesForExport: vi.fn(() => false),
      hasVisibleContactTwinForSvgExport: vi.fn(() => false),
    });

    const svg = actions.buildPreviewExportSvg();
    expect(svg).toContain("<svg");
  });

  it("visible crystal が無いときは xray screen overlay 条件を満たさない", () => {
    const actions = createTwinPreviewExportRuntimeActions({
      state: {
        faceDisplayMode: "xray-grouped",
        previewRoot: null,
        buildResult: null,
      },
      elements: {
        previewStage: document.createElement("div"),
        faceLabelLayer: document.createElement("div"),
        presetMetadataName: document.createElement("div"),
        presetMetadataShortDescription: document.createElement("div"),
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      isCrystalVisible: vi.fn(() => true),
      getTwinCrystals: vi.fn(() => []),
    });

    expect(actions.getVisibleCrystalEntriesForExport()).toEqual([]);
    expect(actions.shouldUseScreenSpaceXrayFaceOverlay()).toBe(true);
  });
});
