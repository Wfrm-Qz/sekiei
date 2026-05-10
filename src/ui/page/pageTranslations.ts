import { applyTranslations } from "../../i18n.js";

/**
 * 静的ラベル更新をまとめる。
 *
 * DOM 参照が多く翻訳項目も多いため、ページ本体から切り離して
 * 「どの要素へどの文言を入れるか」を 1 か所で追えるようにする。
 *
 * 主に扱う日本語文言:
 * - SEKIEI / 保存 / 名前を付けて保存 / JSONを読み込む
 * - プリセット情報 / 名前 / 簡易説明 / 名前（英語） / 説明 / 参考文献
 * - 結晶パラメーター / 双晶パラメーター / 検証結果
 * - 視点リセット / 回転の慣性 / 面指数 / 稜線 / 交線 / 分割面 / 軸（内） / 軸（外）
 */
export function applyPageStaticTranslations(elements, locale, translate) {
  applyTranslations(document);
  document.title = translate("app.pageTitle");
  elements.localeLabel.textContent = translate("common.language");
  document.querySelector(
    ".page-header h1 [data-i18n='app.headerTitle']",
  ).textContent = translate("app.headerTitle");
  document.querySelector(
    ".page-header h1 [data-i18n='app.headerExpansion']",
  ).textContent = translate("app.headerExpansion");
  document.querySelector(".page-header .subtitle").textContent =
    translate("app.subtitle");
  elements.saveButton.textContent = translate("app.save");
  elements.saveAsButton.textContent = translate("app.saveAs");
  elements.importJsonButton.textContent = translate("import.json");
  Array.from(elements.importJsonMenu.children).forEach(
    (option: HTMLOptionElement) => {
      const translationKey =
        option instanceof HTMLElement &&
        option.dataset.importMode === "preview-only"
          ? "import.jsonMode.previewSettings"
          : option instanceof HTMLElement &&
              option.dataset.importMode === "crystal-only"
            ? "import.jsonMode.crystalData"
            : "import.jsonMode.all";
      option.textContent = translate(translationKey);
    },
  );
  elements.presetSelect.placeholder = translate("preset.placeholder");
  elements.presetClearButton.setAttribute(
    "aria-label",
    translate("preset.clearInput"),
  );
  elements.presetToggleButton.setAttribute(
    "aria-label",
    translate("preset.showOptions"),
  );
  document.querySelector(".preset-metadata-card h2").textContent = translate(
    "editor.presetInfoTitle",
  );
  elements.metadataInputs.name
    .closest("label")
    .querySelector("span").textContent = translate("preset.metadata.name");
  elements.metadataInputs.shortDescription
    .closest("label")
    .querySelector("span").textContent = translate(
    "preset.metadata.shortDescription",
  );
  elements.metadataInputs.altName
    .closest("label")
    .querySelector("span").textContent =
    locale === "ja"
      ? translate("preset.metadata.nameEnglish")
      : translate("preset.metadata.nameJapanese");
  elements.metadataInputs.description
    .closest("label")
    .querySelector("span").textContent = translate(
    "preset.metadata.description",
  );
  elements.metadataInputs.reference
    .closest("label")
    .querySelector("span").textContent = translate("preset.metadata.reference");
  elements.metadataInputs.fullReference
    .closest("label")
    .querySelector("span").textContent = translate(
    "preset.metadata.fullReference",
  );
  document.querySelectorAll(
    ".section-card .section-heading h2",
  )[1].textContent = translate("editor.parametersTitle");
  elements.crystalSystemSelect
    .closest("label")
    .querySelector("span").textContent = translate("editor.crystalSystem");
  elements.sizeInput.closest("label").querySelector("span").textContent =
    translate("editor.modelSize");
  document.querySelectorAll(".editor-subheading")[0].textContent =
    translate("editor.axisLengths");
  document.querySelectorAll(".editor-subheading")[1].textContent =
    translate("editor.axisAngles");
  elements.twinSettingsCard.querySelector("h2").textContent =
    translate("twin.settingsTitle");
  elements.twinSettingsCard.querySelector(".section-heading p").textContent =
    translate("twin.settingsDescription");
  elements.fromCrystalSelect
    .closest("label")
    .querySelector("span").textContent = translate("twin.fromCrystal");
  elements.twinTypeSelect.closest("label").querySelector("span").textContent =
    translate("twin.twinType");
  elements.twinTypeSelect.options[0].textContent =
    translate("twin.type.contact");
  elements.twinTypeSelect.options[1].textContent = translate(
    "twin.type.penetration",
  );
  elements.rotationAngleInput
    .closest("label")
    .querySelector("span").textContent = translate("twin.rotationAngle");
  elements.axisOffsetInput.closest("label").querySelector("span").textContent =
    translate("twin.axisOffset");
  elements.contactReferenceAxisSelect
    .closest("label")
    .querySelector("span").textContent = translate("twin.referenceAxis");
  document.querySelectorAll(
    ".section-card .section-heading h2",
  )[3].textContent = translate("editor.validationTitle");
  elements.resetPreviewButton.textContent = translate("preview.reset");
  elements.toggleInertiaInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.useInertia");
  elements.axisViewButtons.setAttribute(
    "aria-label",
    translate("preview.axisViewButtons"),
  );
  const previewHint = document.querySelector(".preview-hint");
  if (previewHint) {
    previewHint.textContent = translate("preview.controlsHint");
  }
  const mobilePreviewHint = document.querySelector(".mobile-preview-hint");
  if (mobilePreviewHint) {
    mobilePreviewHint.textContent = translate("preview.mobileControlsHint");
  }
  const faceDisplayTranslations = {
    grouped: "preview.faceDisplay.grouped",
    solid: "preview.faceDisplay.solid",
    white: "preview.faceDisplay.white",
    transparent: "preview.faceDisplay.transparent",
    "xray-solid": "preview.faceDisplay.xraySolid",
    "xray-grouped": "preview.faceDisplay.xrayGrouped",
    custom: "preview.faceDisplay.custom",
  } as const;
  Array.from(elements.faceDisplayModeSelect.options).forEach(
    (option: HTMLOptionElement) => {
      const translationKey =
        faceDisplayTranslations[
          option.value as keyof typeof faceDisplayTranslations
        ];
      if (translationKey) {
        option.textContent = translate(translationKey);
      }
    },
  );
  elements.toggleFaceLabelsInput
    .closest("label")
    .querySelector("span").textContent = translate(
    "preview.toggle.faceIndices",
  );
  elements.toggleRidgeLinesInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.ridgeLines");
  elements.toggleIntersectionRidgeLinesInput
    .closest("label")
    .querySelector("span").textContent = translate(
    "preview.toggle.intersectionLines",
  );
  elements.toggleAxisLinesInnerInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.axisInner");
  elements.toggleAxisLinesOuterInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.axisOuter");
  elements.toggleAxisLabelsInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.axisLabels");
  elements.toggleTwinRuleInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.twinRule");
  elements.togglePresetMetadataInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.metadata");
  elements.toggleSplitPlaneInput
    .closest("label")
    .querySelector("span").textContent = translate("preview.toggle.splitPlane");
  document.querySelector(".face-section-card h2").textContent = translate(
    "editor.faceListTitle",
  );
  elements.faceCrystalTabsContainer.setAttribute(
    "aria-label",
    translate("editor.faceTarget"),
  );
}
