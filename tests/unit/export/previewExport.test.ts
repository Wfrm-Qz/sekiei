import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import {
  createTwinPreviewExportActions,
  createTwinPreviewExportRuntimeActions,
} from "../../../src/export/previewExport.ts";

/**
 * export/previewExport の builder / runtime factory を確認する smoke unit test。
 */
describe("export/previewExport", () => {
  it("正常系として preview export actions は主要 builder を返す", () => {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "clientWidth", { value: 200 });
    Object.defineProperty(stage, "clientHeight", { value: 100 });
    const canvas = document.createElement("canvas");
    canvas.width = 200;
    canvas.height = 100;
    const renderer = { render: vi.fn() } as unknown as THREE.WebGLRenderer;

    const actions = createTwinPreviewExportActions({
      state: {
        previewRoot: new THREE.Group(),
        ridgeLines: null,
        intersectionRidgeLines: null,
        axisGuideGroup: null,
        twinRuleGuideGroup: null,
      },
      elements: { previewStage: stage, canvas },
      renderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      requestPreviewRender: vi.fn(),
      hasNamedAncestor: vi.fn(() => false),
      getExportSurfaceData: vi.fn(() => null),
      collectPreviewExportPolygons: vi.fn(() => ({
        polygons: [],
        paths: [],
        opaqueTriangles: [],
        helperPolygons: [],
        debugLog: {},
      })),
      collectPreviewExportLines: vi.fn(() => []),
      getPreviewTextOverlays: vi.fn(() => []),
      shouldMergeVectorSvgBodyFacesForExport: vi.fn(() => false),
      hasVisibleContactTwinForSvgExport: vi.fn(() => false),
    });

    expect(typeof actions.buildPreviewExportSvg).toBe("function");
    expect(typeof actions.buildPreviewPngBlob).toBe("function");
    expect(typeof actions.buildPreviewJpegBlob).toBe("function");
  });

  it("異常系寄りとして runtime actions は visible crystal が無ければ空配列を返せる", () => {
    const actions = createTwinPreviewExportRuntimeActions({
      state: {
        faceDisplayMode: "solid",
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
    expect(actions.shouldUseScreenSpaceXrayFaceOverlay()).toBe(false);
  });

  it("xray overlay canvas が見えている時は PNG 合成に重ねる", async () => {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "clientWidth", { value: 200 });
    Object.defineProperty(stage, "clientHeight", { value: 100 });

    const sourceCanvas = document.createElement("canvas");
    sourceCanvas.width = 200;
    sourceCanvas.height = 100;
    const xrayCanvas = document.createElement("canvas");
    xrayCanvas.width = 200;
    xrayCanvas.height = 100;
    xrayCanvas.style.display = "block";

    const renderer = { render: vi.fn() } as unknown as THREE.WebGLRenderer;
    const drawImage = vi.fn();
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = 200;
    exportCanvas.height = 100;
    Object.defineProperty(exportCanvas, "getContext", {
      value: () => ({
        fillRect: vi.fn(),
        clearRect: vi.fn(),
        drawImage,
        scale: vi.fn(),
        fillText: vi.fn(),
        setTransform: vi.fn(),
        fillStyle: "",
        font: "",
        textAlign: "left",
        textBaseline: "middle",
      }),
    });
    Object.defineProperty(exportCanvas, "toBlob", {
      value: (callback: (blob: Blob | null) => void) =>
        callback(new Blob(["png"])),
    });

    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, "createElement")
      .mockImplementation((tagName: string) => {
        if (tagName === "canvas") {
          return exportCanvas;
        }
        return originalCreateElement(tagName);
      });

    const actions = createTwinPreviewExportActions({
      state: {
        previewRoot: new THREE.Group(),
        ridgeLines: null,
        intersectionRidgeLines: null,
        axisGuideGroup: null,
        twinRuleGuideGroup: null,
        faceDisplayMode: "xray-solid",
      },
      elements: {
        previewStage: stage,
        canvas: sourceCanvas,
        xrayFaceCanvas: xrayCanvas,
      },
      renderer,
      scene: new THREE.Scene(),
      camera: new THREE.PerspectiveCamera(),
      requestPreviewRender: vi.fn(),
      hasNamedAncestor: vi.fn(() => false),
      getExportSurfaceData: vi.fn(() => null),
      collectPreviewExportPolygons: vi.fn(() => ({
        polygons: [],
        paths: [],
        opaqueTriangles: [],
        helperPolygons: [],
        debugLog: {},
      })),
      collectPreviewExportLines: vi.fn(() => []),
      getPreviewTextOverlays: vi.fn(() => []),
      shouldMergeVectorSvgBodyFacesForExport: vi.fn(() => false),
      hasVisibleContactTwinForSvgExport: vi.fn(() => false),
    });

    await actions.buildPreviewPngBlob();

    expect(drawImage).toHaveBeenNthCalledWith(1, sourceCanvas, 0, 0, 200, 100);
    expect(drawImage).toHaveBeenNthCalledWith(2, xrayCanvas, 0, 0, 200, 100);

    createElementSpy.mockRestore();
  });
});
