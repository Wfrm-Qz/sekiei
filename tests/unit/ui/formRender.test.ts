import { describe, expect, it } from "vitest";
import {
  applyTwinAngleFieldValues,
  applyTwinAxisFieldValues,
  applyTwinFaceSectionColors,
  applyTwinPreviewStyleAxisLabels,
  applyTwinPreviewStyleValues,
  applyTwinPreviewToggleValues,
  applyTwinRuleFieldValues,
  buildTwinFromCrystalOptions,
} from "../../../src/ui/formRender.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";

/**
 * ui/formRender のフォーム値反映 helper を確認する unit test。
 */
describe("ui/formRender", () => {
  it("applyTwinAxisFieldValues は正常系で値と disabled を反映する", () => {
    const axisInputs = {
      a: document.createElement("input"),
      b: document.createElement("input"),
      c: document.createElement("input"),
    };

    applyTwinAxisFieldValues(
      axisInputs,
      { a: 1, b: 2, c: 3 },
      "monoclinic",
      (_systemId, kind, axisName) => kind === "axis" && axisName === "b",
    );

    expect(axisInputs.a.value).toBe("1");
    expect(axisInputs.b.value).toBe("2");
    expect(axisInputs.c.value).toBe("3");
    expect(axisInputs.a.disabled).toBe(false);
    expect(axisInputs.b.disabled).toBe(true);
  });

  it("applyTwinAngleFieldValues は異常系寄りでも callback 判定どおり disabled を反映する", () => {
    const angleInputs = {
      alpha: document.createElement("input"),
      beta: document.createElement("input"),
      gamma: document.createElement("input"),
    };

    applyTwinAngleFieldValues(
      angleInputs,
      { alpha: 90, beta: 100, gamma: 120 },
      "triclinic",
      () => true,
    );

    expect(angleInputs.alpha.value).toBe("90");
    expect(angleInputs.beta.value).toBe("100");
    expect(angleInputs.gamma.value).toBe("120");
    expect(angleInputs.alpha.disabled).toBe(true);
    expect(angleInputs.beta.disabled).toBe(true);
    expect(angleInputs.gamma.disabled).toBe(true);
  });

  it("applyTwinRuleFieldValues / applyTwinPreviewToggleValues は各入力欄へ値を流し込む", () => {
    const ruleInputs = {
      h: document.createElement("input"),
      k: document.createElement("input"),
      i: document.createElement("input"),
      l: document.createElement("input"),
    };
    const rotationAngleInput = document.createElement("input");
    const axisOffsetInput = document.createElement("input");

    applyTwinRuleFieldValues(
      ruleInputs,
      { h: 1, k: 2, i: -3, l: 4 },
      rotationAngleInput,
      60,
      axisOffsetInput,
      0.25,
    );

    expect(ruleInputs.h.value).toBe("1");
    expect(ruleInputs.k.value).toBe("2");
    expect(ruleInputs.i.value).toBe("-3");
    expect(ruleInputs.l.value).toBe("4");
    expect(rotationAngleInput.value).toBe("60");
    expect(axisOffsetInput.value).toBe("0.25");

    const toggleElements = {
      faceDisplayModeSelect: document.createElement("select"),
      toggleFaceLabelsInput: document.createElement("input"),
      toggleAxisLabelsInput: document.createElement("input"),
      toggleAxisLinesInnerInput: document.createElement("input"),
      toggleAxisLinesOuterInput: document.createElement("input"),
      toggleTwinRuleInput: document.createElement("input"),
      toggleRidgeLinesInput: document.createElement("input"),
      toggleIntersectionRidgeLinesInput: document.createElement("input"),
      togglePresetMetadataInput: document.createElement("input"),
      toggleSplitPlaneInput: document.createElement("input"),
      toggleInertiaInput: document.createElement("input"),
    };
    Object.values(toggleElements).forEach((element) => {
      if (element instanceof HTMLInputElement) {
        element.type = "checkbox";
      }
    });
    toggleElements.faceDisplayModeSelect.innerHTML = `
      <option value="grouped">grouped</option>
      <option value="xray-grouped">xray-grouped</option>
    `;

    applyTwinPreviewToggleValues(toggleElements, {
      faceDisplayMode: "xray-grouped",
      showFaceLabels: true,
      showAxisLabels: false,
      showAxisLinesInner: true,
      showAxisLinesOuter: false,
      showTwinRuleGuide: true,
      showSplitPlaneGuide: true,
      showRidgeLines: false,
      showIntersectionRidgeLines: true,
      showPresetMetadata: false,
      useInertia: true,
    });

    expect(toggleElements.faceDisplayModeSelect.value).toBe("xray-grouped");
    expect(toggleElements.toggleFaceLabelsInput.checked).toBe(true);
    expect(toggleElements.toggleAxisLabelsInput.checked).toBe(false);
    expect(toggleElements.toggleSplitPlaneInput.checked).toBe(true);
    expect(toggleElements.toggleInertiaInput.checked).toBe(true);
  });

  it("applyTwinFaceSectionColors / buildTwinFromCrystalOptions は style と option list を反映する", () => {
    const faceElements = {
      faceTabsWrap: document.createElement("div"),
      faceTableWrap: document.createElement("div"),
      facesTableHeadRow: document.createElement("tr"),
    };

    applyTwinFaceSectionColors(faceElements, {
      cardBackground: "#111111",
      tableBackground: "#222222",
      tableHeadBackground: "#333333",
    });

    expect(
      faceElements.faceTabsWrap.style.getPropertyValue(
        "--face-section-header-background",
      ),
    ).toBe("#111111");
    expect(
      faceElements.faceTableWrap.style.getPropertyValue(
        "--face-table-shell-background",
      ),
    ).toBe("#222222");

    expect(
      buildTwinFromCrystalOptions(
        [{}, {}, {}],
        2,
        (index: number) => `結晶${index + 1}`,
      ),
    ).toEqual([
      { value: "0", label: "結晶1" },
      { value: "1", label: "結晶2" },
    ]);
    expect(buildTwinFromCrystalOptions([{}], 0, () => "unused")).toEqual([]);
  });

  it("applyTwinPreviewStyleAxisLabels は四指数系だけ a1/a2/a3/c 表記へ切り替える", () => {
    document.body.innerHTML = `
      <div id="panel">
        <label><span>a軸の色</span><input data-preview-style-key="axisLines.colors.a" /></label>
        <label><span>b軸の色</span><input data-preview-style-key="axisLines.colors.b" /></label>
        <label><span>a3軸の色</span><input data-preview-style-key="axisLines.colors.a3" /></label>
        <label><span>c軸の色</span><input data-preview-style-key="axisLines.colors.c" /></label>
        <label><span>a軸ラベルの色</span><input data-preview-style-key="axisLabel.colors.a" /></label>
        <label><span>b軸ラベルの色</span><input data-preview-style-key="axisLabel.colors.b" /></label>
        <label><span>a3軸ラベルの色</span><input data-preview-style-key="axisLabel.colors.a3" /></label>
        <label><span>c軸ラベルの色</span><input data-preview-style-key="axisLabel.colors.c" /></label>
      </div>
    `;
    const panel = document.getElementById("panel");
    const translate = (key: string) =>
      ({
        "preview.settings.axisColorA": "a軸の色",
        "preview.settings.axisColorA1": "a1軸の色",
        "preview.settings.axisColorB": "b軸の色",
        "preview.settings.axisColorA2": "a2軸の色",
        "preview.settings.axisColorA3": "a3軸の色",
        "preview.settings.axisColorC": "c軸の色",
        "preview.settings.axisLabelColorA": "a軸ラベルの色",
        "preview.settings.axisLabelColorA1": "a1軸ラベルの色",
        "preview.settings.axisLabelColorB": "b軸ラベルの色",
        "preview.settings.axisLabelColorA2": "a2軸ラベルの色",
        "preview.settings.axisLabelColorA3": "a3軸ラベルの色",
        "preview.settings.axisLabelColorC": "c軸ラベルの色",
      })[key] ?? key;

    applyTwinPreviewStyleAxisLabels(panel, true, translate);

    expect(panel?.querySelectorAll("label span")[0]?.textContent).toBe(
      "a1軸の色",
    );
    expect(panel?.querySelectorAll("label span")[1]?.textContent).toBe(
      "a2軸の色",
    );
    expect(panel?.querySelectorAll("label span")[2]?.textContent).toBe(
      "a3軸の色",
    );
    expect(panel?.querySelectorAll("label span")[3]?.textContent).toBe(
      "c軸の色",
    );
    expect(panel?.querySelectorAll("label span")[4]?.textContent).toBe(
      "a1軸ラベルの色",
    );
    expect(panel?.querySelectorAll("label span")[5]?.textContent).toBe(
      "a2軸ラベルの色",
    );
    expect(panel?.querySelectorAll("label span")[6]?.textContent).toBe(
      "a3軸ラベルの色",
    );
    expect(panel?.querySelectorAll("label span")[7]?.textContent).toBe(
      "c軸ラベルの色",
    );
    expect(panel?.querySelectorAll("label")[2]?.hidden).toBe(false);
    expect(panel?.querySelectorAll("label")[6]?.hidden).toBe(false);

    applyTwinPreviewStyleAxisLabels(panel, false, translate);

    expect(panel?.querySelectorAll("label span")[0]?.textContent).toBe(
      "a軸の色",
    );
    expect(panel?.querySelectorAll("label span")[1]?.textContent).toBe(
      "b軸の色",
    );
    expect(panel?.querySelectorAll("label span")[4]?.textContent).toBe(
      "a軸ラベルの色",
    );
    expect(panel?.querySelectorAll("label span")[5]?.textContent).toBe(
      "b軸ラベルの色",
    );
    expect(panel?.querySelectorAll("label")[2]?.hidden).toBe(true);
    expect(panel?.querySelectorAll("label")[6]?.hidden).toBe(true);
  });

  it("applyTwinPreviewStyleValues は checkbox を checked として同期する", () => {
    document.body.innerHTML = `
      <div id="panel">
        <input data-preview-style-key="faceLabel.color" type="color" />
        <input data-preview-style-key="customLineProfile.useLayeredLines" type="checkbox" />
      </div>
    `;
    const panel = document.getElementById("panel");
    const settings = createDefaultTwinPreviewStyleSettings();

    settings.customLineProfile.useLayeredLines = false;
    applyTwinPreviewStyleValues(panel, settings);

    expect(
      (
        panel?.querySelector(
          '[data-preview-style-key="faceLabel.color"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("#1f2a37");
    expect(
      (
        panel?.querySelector(
          '[data-preview-style-key="customLineProfile.useLayeredLines"]',
        ) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it("groupedFaceComponentOpacity が null でも UI 上は 0 を表示する", () => {
    document.body.innerHTML = `
      <div id="panel">
        <input
          data-preview-style-key="customFaceProfile.groupedFaceComponentOpacity"
          type="number"
        />
      </div>
    `;
    const panel = document.getElementById("panel");
    const settings = createDefaultTwinPreviewStyleSettings();

    settings.customFaceProfile.groupedFaceComponentOpacity = null;
    applyTwinPreviewStyleValues(panel, settings);

    expect(
      (
        panel?.querySelector(
          '[data-preview-style-key="customFaceProfile.groupedFaceComponentOpacity"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("0");
  });
});
