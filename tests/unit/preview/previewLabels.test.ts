import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import {
  appendIndexLabelTokens,
  buildIndexLabelParts,
  createTwinPreviewLabelActions,
  invertIndexLabelParts,
} from "../../../src/preview/previewLabels.ts";

/**
 * preview/previewLabels の指数 token と label layer 制御を確認する unit test。
 */
describe("preview/previewLabels", () => {
  it("buildIndexLabelParts は 4 index / 3 index を作り、欠損値は 0 扱いにする", () => {
    expect(buildIndexLabelParts({ h: 1, k: -2, i: 1, l: 4 }, true)).toEqual([
      { text: "1", negative: false },
      { text: "2", negative: true },
      { text: "1", negative: false },
      { text: "4", negative: false },
    ]);

    expect(buildIndexLabelParts(null, false)).toEqual([
      { text: "0", negative: false },
      { text: "0", negative: false },
      { text: "0", negative: false },
    ]);
  });

  it("appendIndexLabelTokens / invertIndexLabelParts は overline と符号反転を扱う", () => {
    const element = document.createElement("div");
    const parts = [
      { text: "1", negative: false },
      { text: "2", negative: true },
      { text: "0", negative: false },
    ];

    appendIndexLabelTokens(element, parts);
    expect(element.querySelectorAll(".face-index-token")).toHaveLength(3);
    expect(element.querySelector(".overline")).toHaveTextContent("2");
    expect(invertIndexLabelParts(parts)).toEqual([
      { text: "1", negative: true },
      { text: "2", negative: false },
      { text: "0", negative: false },
    ]);
  });

  it("createFaceLabelAnchors / createAxisLabelAnchors は正常系で DOM を作り、表示フラグで layer visibility を切り替える", () => {
    document.body.innerHTML = `
      <div id="layer"></div>
      <div id="stage" style="width:400px;height:300px"></div>
    `;
    const layer = document.querySelector("#layer") as HTMLElement;
    const stage = document.querySelector("#stage") as HTMLElement;
    Object.defineProperty(stage, "clientWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(stage, "clientHeight", {
      value: 300,
      configurable: true,
    });

    const actions = createTwinPreviewLabelActions({
      state: {
        previewRoot: null,
        facePickTargets: [],
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        showFaceLabels: true,
        showAxisLabels: false,
        showTwinRuleGuide: false,
        isPreviewDragging: false,
        previewInertiaActive: false,
      },
      elements: {
        faceLabelLayer: layer,
        previewStage: stage,
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewHelperNames: new Set<string>(),
      axisLabelInitialOuterOffset: 18,
      axisLabelSideGap: 8,
    });

    const faceAnchors = actions.createFaceLabelAnchors(
      {
        faces: [
          {
            labelParts: [{ text: "1", negative: false }],
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            normal: { x: 0, y: 0, z: 1 },
          },
        ],
      },
      "source-1",
    );
    const axisAnchors = actions.createAxisLabelAnchors([
      {
        label: "a",
        color: "#ff0000",
        start: { x: 0, y: 0, z: 0 },
        end: { x: 1, y: 0, z: 0 },
      },
    ]);

    expect(faceAnchors).toHaveLength(1);
    expect(faceAnchors[0].element.dataset.source).toBe("source-1");
    expect(axisAnchors).toHaveLength(1);
    expect(axisAnchors[0].element).toHaveTextContent("a");

    actions.applyLabelLayerVisibility();
    expect(layer.style.display).toBe("block");

    const hiddenActions = createTwinPreviewLabelActions({
      state: {
        previewRoot: null,
        facePickTargets: [],
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        showFaceLabels: false,
        showAxisLabels: false,
        showTwinRuleGuide: false,
        isPreviewDragging: false,
        previewInertiaActive: false,
      },
      elements: { faceLabelLayer: layer, previewStage: stage },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewHelperNames: new Set<string>(),
      axisLabelInitialOuterOffset: 18,
      axisLabelSideGap: 8,
    });
    hiddenActions.applyLabelLayerVisibility();
    expect(layer.style.display).toBe("none");
  });

  it("axis anchor は軸線色とは独立した軸ラベル色を使う", () => {
    document.body.innerHTML = `
      <div id="layer"></div>
      <div id="stage" style="width:400px;height:300px"></div>
    `;
    const layer = document.querySelector("#layer") as HTMLElement;
    const stage = document.querySelector("#stage") as HTMLElement;
    Object.defineProperty(stage, "clientWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(stage, "clientHeight", {
      value: 300,
      configurable: true,
    });

    const previewRoot = new THREE.Group();
    const settings = createDefaultTwinPreviewStyleSettings();
    settings.axisLines.colors.a = "#ff0000";
    settings.axisLabel.colors = {
      ...settings.axisLabel.colors,
      a: "#003f78",
    };
    const state = {
      previewRoot,
      facePickTargets: [],
      faceLabelAnchors: [],
      axisLabelAnchors: [],
      twinRuleLabelAnchors: [],
      previewStyleSettings: settings,
      showFaceLabels: false,
      showAxisLabels: true,
      showTwinRuleGuide: false,
      isPreviewDragging: false,
      previewInertiaActive: false,
    };
    const actions = createTwinPreviewLabelActions({
      state,
      elements: { faceLabelLayer: layer, previewStage: stage },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewHelperNames: new Set<string>(),
      axisLabelInitialOuterOffset: 18,
      axisLabelSideGap: 8,
    });

    const axisAnchors = actions.createAxisLabelAnchors([
      {
        label: "a",
        color: "#ff0000",
        start: { x: 0, y: 0, z: -2 },
        end: { x: 1, y: 0, z: -2 },
      },
    ]);
    state.axisLabelAnchors = axisAnchors;

    (
      actions as { updateFaceLabelOverlay: () => void }
    ).updateFaceLabelOverlay();
    expect(axisAnchors[0].element.style.color).toBe("rgb(0, 63, 120)");
  });

  it("face label anchor は faceLabel.offset の値だけ法線方向へ離す", () => {
    document.body.innerHTML = `
      <div id="layer"></div>
      <div id="stage" style="width:400px;height:300px"></div>
    `;
    const layer = document.querySelector("#layer") as HTMLElement;
    const stage = document.querySelector("#stage") as HTMLElement;
    Object.defineProperty(stage, "clientWidth", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(stage, "clientHeight", {
      value: 300,
      configurable: true,
    });

    const settings = createDefaultTwinPreviewStyleSettings();
    settings.faceLabel.offset = 0.8;
    const actions = createTwinPreviewLabelActions({
      state: {
        previewRoot: null,
        facePickTargets: [],
        faceLabelAnchors: [],
        axisLabelAnchors: [],
        twinRuleLabelAnchors: [],
        previewStyleSettings: settings,
        showFaceLabels: true,
        showAxisLabels: false,
        showTwinRuleGuide: false,
        isPreviewDragging: false,
        previewInertiaActive: false,
      },
      elements: {
        faceLabelLayer: layer,
        previewStage: stage,
      },
      camera: new THREE.PerspectiveCamera(),
      raycaster: new THREE.Raycaster(),
      previewHelperNames: new Set<string>(),
      axisLabelInitialOuterOffset: 18,
      axisLabelSideGap: 8,
    });

    const faceAnchors = actions.createFaceLabelAnchors(
      {
        faces: [
          {
            labelParts: [{ text: "1", negative: false }],
            vertices: [
              { x: 0, y: 0, z: 0 },
              { x: 1, y: 0, z: 0 },
              { x: 0, y: 1, z: 0 },
            ],
            normal: { x: 0, y: 0, z: 1 },
          },
        ],
      },
      "source-1",
    );

    expect(faceAnchors[0].position.z).toBeCloseTo(0.8, 6);
  });
});
