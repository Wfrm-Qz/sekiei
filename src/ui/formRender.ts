/**
 * フォーム再描画で使う DOM 同期 helper 群。
 *
 * handler や state 更新は持たず、`state` から決めた値を各 input / style に反映するだけに絞る。
 *
 * 主に扱う日本語文言:
 * - プレビュー詳細設定 / 高度な設定(β版)
 * - 面スタイル / 線スタイル
 * - 高度な設定の各 raw property 名
 */

import { readTwinPreviewStyleValue } from "../preview/previewStyleSettings.js";

export function applyTwinAxisFieldValues(
  axisInputs,
  axes,
  crystalSystem,
  isFieldLocked,
) {
  for (const axisName of ["a", "b", "c"]) {
    axisInputs[axisName].value = axes[axisName];
    axisInputs[axisName].disabled = isFieldLocked(
      crystalSystem,
      "axis",
      axisName,
    );
  }
}

export function applyTwinAngleFieldValues(
  angleInputs,
  angles,
  crystalSystem,
  isFieldLocked,
) {
  for (const angleName of ["alpha", "beta", "gamma"]) {
    angleInputs[angleName].value = angles[angleName];
    angleInputs[angleName].disabled = isFieldLocked(
      crystalSystem,
      "angle",
      angleName,
    );
  }
}

export function applyTwinRuleFieldValues(
  ruleInputs,
  rule,
  rotationAngleInput,
  rotationAngleDeg,
) {
  ruleInputs.h.value = rule.h;
  ruleInputs.k.value = rule.k;
  ruleInputs.i.value = rule.i;
  ruleInputs.l.value = rule.l;
  rotationAngleInput.value = rotationAngleDeg;
}

export function applyTwinPreviewToggleValues(toggleElements, values) {
  toggleElements.faceDisplayModeSelect.value = values.faceDisplayMode;
  toggleElements.toggleFaceLabelsInput.checked = values.showFaceLabels;
  toggleElements.toggleAxisLabelsInput.checked = values.showAxisLabels;
  toggleElements.toggleAxisLinesInnerInput.checked = values.showAxisLinesInner;
  toggleElements.toggleAxisLinesOuterInput.checked = values.showAxisLinesOuter;
  toggleElements.toggleTwinRuleInput.checked = values.showTwinRuleGuide;
  toggleElements.toggleRidgeLinesInput.checked = values.showRidgeLines;
  toggleElements.toggleIntersectionRidgeLinesInput.checked =
    values.showIntersectionRidgeLines;
  toggleElements.togglePresetMetadataInput.checked = values.showPresetMetadata;
  toggleElements.toggleSplitPlaneInput.checked = values.showSplitPlaneGuide;
  toggleElements.toggleInertiaInput.checked = values.useInertia;
}

export function applyTwinPreviewStyleValues(stylePanel, styleSettings) {
  if (!stylePanel) {
    return;
  }
  stylePanel.querySelectorAll("[data-preview-style-key]").forEach((element) => {
    const key = element.dataset.previewStyleKey;
    if (!key) {
      return;
    }
    const value = readTwinPreviewStyleValue(styleSettings, key);
    if (
      element instanceof HTMLInputElement ||
      element instanceof HTMLSelectElement
    ) {
      if (element instanceof HTMLInputElement && element.type === "checkbox") {
        element.checked = Boolean(value);
        return;
      }
      if (
        key === "customFaceProfile.groupedFaceComponentOpacity" &&
        value == null
      ) {
        element.value = "0";
        return;
      }
      element.value = String(value ?? "");
    }
  });
}

export function applyTwinPreviewStyleAxisLabels(
  stylePanel,
  useFourAxis,
  translate,
) {
  if (!stylePanel) {
    return;
  }
  const axisLabelKeySets = [
    {
      prefix: "axisLines.colors",
      translationMap: new Map([
        [
          "a",
          useFourAxis
            ? "preview.settings.axisColorA1"
            : "preview.settings.axisColorA",
        ],
        [
          "b",
          useFourAxis
            ? "preview.settings.axisColorA2"
            : "preview.settings.axisColorB",
        ],
        ["a3", "preview.settings.axisColorA3"],
        ["c", "preview.settings.axisColorC"],
      ]),
    },
    {
      prefix: "axisLabel.colors",
      translationMap: new Map([
        [
          "a",
          useFourAxis
            ? "preview.settings.axisLabelColorA1"
            : "preview.settings.axisLabelColorA",
        ],
        [
          "b",
          useFourAxis
            ? "preview.settings.axisLabelColorA2"
            : "preview.settings.axisLabelColorB",
        ],
        ["a3", "preview.settings.axisLabelColorA3"],
        ["c", "preview.settings.axisLabelColorC"],
      ]),
    },
  ];
  axisLabelKeySets.forEach(({ prefix, translationMap }) => {
    translationMap.forEach((translationKey, axisKey) => {
      const previewStyleKey = `${prefix}.${axisKey}`;
      const input = stylePanel.querySelector(
        `[data-preview-style-key="${previewStyleKey}"]`,
      );
      const label = input?.closest("label");
      if (previewStyleKey.endsWith(".a3") && label instanceof HTMLElement) {
        const shouldShow = useFourAxis;
        label.hidden = !shouldShow;
        label.style.display = shouldShow ? "" : "none";
        if (
          input instanceof HTMLInputElement ||
          input instanceof HTMLSelectElement
        ) {
          input.disabled = !shouldShow;
        }
      }
      const textElement = label?.querySelector("span");
      if (!(textElement instanceof HTMLElement)) {
        return;
      }
      textElement.textContent = translate(translationKey);
    });
  });
}

export function applyTwinFaceSectionColors(
  faceElements,
  activeCrystalUiColors,
) {
  faceElements.faceTabsWrap.style.setProperty(
    "--face-section-header-background",
    activeCrystalUiColors.cardBackground,
  );
  faceElements.faceTableWrap.style.setProperty(
    "--face-table-shell-background",
    activeCrystalUiColors.tableBackground,
  );
  faceElements.facesTableHeadRow.style.setProperty(
    "--face-table-head-background",
    activeCrystalUiColors.tableHeadBackground,
  );
}

export function buildTwinFromCrystalOptions(
  crystals,
  activeCrystalIndex,
  formatCrystalUiLabel,
) {
  return crystals
    .slice(0, Math.max(0, activeCrystalIndex))
    .map((crystal, index) => ({
      value: String(index),
      label: formatCrystalUiLabel(index),
    }));
}
