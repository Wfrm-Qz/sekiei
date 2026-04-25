import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createTwinXrayOverlayActions } from "../../../src/preview/xrayOverlay.ts";
import { createDefaultEditableTwinPreviewLineProfile } from "../../../src/preview/previewProfiles.ts";

/**
 * preview/xrayOverlay の表示同期と描画入口を確認する smoke unit test。
 */
describe("preview/xrayOverlay", () => {
  function createContext() {
    const stage = document.createElement("div");
    Object.defineProperty(stage, "clientWidth", { value: 160 });
    Object.defineProperty(stage, "clientHeight", { value: 120 });
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;

    return {
      state: {
        faceDisplayMode: "xray-grouped",
        previewRoot: null,
        ridgeLines: null,
        intersectionRidgeLines: null,
        showRidgeLines: true,
        showIntersectionRidgeLines: true,
        buildResult: null,
      },
      previewStage: stage,
      xrayFaceCanvas: canvas,
      isPreviewRotating: vi.fn(() => false),
      shouldUseScreenSpaceXrayFaceOverlay: vi.fn(() => true),
      getVisibleCrystalEntriesForExport: vi.fn(() => []),
      getSourceFacesForCrystalIndex: vi.fn(() => []),
      resolveXrayPreviewFaceColor: vi.fn(() => "#ffffff"),
      projectWorldPointToExport: vi.fn(() => ({ x: 0, y: 0, cameraZ: 0 })),
      getXrayPreviewFaceOpacity: vi.fn(() => 0.6),
      hasNamedAncestor: vi.fn((object, name) => {
        let current = object?.parent ?? null;
        while (current) {
          if (current.name === name) {
            return true;
          }
          current = current.parent;
        }
        return false;
      }),
      getExportSurfaceData: vi.fn(() => null),
      collectTransparentXrayExportTriangles: vi.fn(() => ({
        opaqueTriangles: [],
      })),
      collectPreviewExportLines: vi.fn(() => []),
    };
  }

  it("正常系として visibility helper は display を同期できる", () => {
    const context = createContext();
    const actions = createTwinXrayOverlayActions(context);

    actions.syncXrayFaceOverlayVisibility();

    expect((context.xrayFaceCanvas as HTMLCanvasElement).style.display).toBe(
      "block",
    );
  });

  it("異常系寄りとして previewRoot が無くても overlay render は例外にしない", () => {
    const context = createContext();
    const actions = createTwinXrayOverlayActions(context);

    expect(() => actions.renderScreenSpaceXrayFaceOverlay()).not.toThrow();
  });

  it("grouped では profile 上 overlay を使わないため canvas を非表示にする", () => {
    const context = createContext();
    context.state.faceDisplayMode = "grouped";
    const actions = createTwinXrayOverlayActions(context);

    actions.syncXrayFaceOverlayVisibility();

    expect((context.xrayFaceCanvas as HTMLCanvasElement).style.display).toBe(
      "none",
    );
  });

  it("custom で line overlay だけ有効なら canvas を表示する", () => {
    const context = createContext();
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useScreenSpaceLineOverlay = true;
    context.state.faceDisplayMode = "custom";
    context.state.previewStyleSettings = {
      customLineProfile: customLine,
    };
    context.shouldUseScreenSpaceXrayFaceOverlay = vi.fn(() => false);
    const actions = createTwinXrayOverlayActions(context);

    actions.syncXrayFaceOverlayVisibility();

    expect((context.xrayFaceCanvas as HTMLCanvasElement).style.display).toBe(
      "block",
    );
  });

  it("showHiddenSurfaceLines=false なら hiddenSurface の hidden layer を隠す", () => {
    const context = createContext();
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useScreenSpaceLineOverlay = true;
    customLine.showHiddenSurfaceLines = false;
    context.state.faceDisplayMode = "custom";
    context.state.previewStyleSettings = {
      customLineProfile: customLine,
    };

    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    ridgeGroup.userData.previewRidgeSegmentKind = "surface";
    const hidden = new THREE.Object3D();
    hidden.userData.previewLineLayer = "hidden";
    const front = new THREE.Object3D();
    front.userData.previewLineLayer = "front";
    ridgeGroup.add(hidden);
    ridgeGroup.add(front);
    context.state.previewRoot = ridgeGroup;
    context.state.ridgeLines = ridgeGroup;

    const actions = createTwinXrayOverlayActions(context as never);
    actions.applyXrayOverlaySceneVisibility(false);

    expect(hidden.visible).toBe(false);
    expect(front.visible).toBe(true);
  });

  it("showFrontLines=false なら hiddenSurface の front layer を隠す", () => {
    const context = createContext();
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useScreenSpaceLineOverlay = true;
    customLine.showHiddenSurfaceLines = true;
    customLine.showFrontLines = false;
    context.state.faceDisplayMode = "custom";
    context.state.previewStyleSettings = {
      customLineProfile: customLine,
    };

    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    ridgeGroup.userData.previewRidgeSegmentKind = "surface";
    const hidden = new THREE.Object3D();
    hidden.userData.previewLineLayer = "hidden";
    const front = new THREE.Object3D();
    front.userData.previewLineLayer = "front";
    ridgeGroup.add(hidden);
    ridgeGroup.add(front);
    context.state.previewRoot = ridgeGroup;
    context.state.ridgeLines = ridgeGroup;

    const actions = createTwinXrayOverlayActions(context as never);
    actions.applyXrayOverlaySceneVisibility(false);

    expect(hidden.visible).toBe(true);
    expect(front.visible).toBe(false);
  });

  it("showFrontLines=false なら intersection の front layer も隠す", () => {
    const context = createContext();
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useScreenSpaceLineOverlay = true;
    customLine.showFrontLines = false;
    context.state.faceDisplayMode = "custom";
    context.state.previewStyleSettings = {
      customLineProfile: customLine,
    };

    const intersectionGroup = new THREE.Group();
    intersectionGroup.name = "preview-intersection-ridge-lines";
    const hidden = new THREE.Object3D();
    hidden.userData.previewLineLayer = "hidden";
    const front = new THREE.Object3D();
    front.userData.previewLineLayer = "front";
    intersectionGroup.add(hidden);
    intersectionGroup.add(front);
    context.state.previewRoot = intersectionGroup;
    context.state.intersectionRidgeLines = intersectionGroup;

    const actions = createTwinXrayOverlayActions(context as never);
    actions.applyXrayOverlaySceneVisibility(false);

    expect(hidden.visible).toBe(true);
    expect(front.visible).toBe(false);
  });

  it("occludedInterior は hidden layer だけを表示対象にする", () => {
    const context = createContext();
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    customLine.useScreenSpaceLineOverlay = true;
    customLine.showOccludedInteriorLines = true;
    context.state.faceDisplayMode = "custom";
    context.state.previewStyleSettings = {
      customLineProfile: customLine,
    };

    const ridgeGroup = new THREE.Group();
    ridgeGroup.name = "preview-ridge-lines";
    ridgeGroup.userData.previewRidgeSegmentKind = "occludedInterior";
    const hidden = new THREE.Object3D();
    hidden.userData.previewLineLayer = "hidden";
    const front = new THREE.Object3D();
    front.userData.previewLineLayer = "front";
    ridgeGroup.add(hidden);
    ridgeGroup.add(front);
    context.state.previewRoot = ridgeGroup;
    context.state.ridgeLines = ridgeGroup;

    const actions = createTwinXrayOverlayActions(context as never);
    actions.applyXrayOverlaySceneVisibility(false);

    expect(hidden.visible).toBe(true);
    expect(front.visible).toBe(false);
  });
});
