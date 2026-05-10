/**
 * DOM 要素の取得をまとめる。
 *
 * `main.ts` は id / class / data 属性への依存が多いため、
 * 要素取得の一覧を 1 か所へ寄せて HTML 変更時の確認地点を明確にする。
 */
export function queryAppPageElements() {
  return {
    mainContent: document.querySelector<HTMLElement>("#app-main-content"),
    localeLabel: document.querySelector("#app-locale-label"),
    localeSelect: document.querySelector("#app-locale-select"),
    mobileLayoutTabs: document.querySelector<HTMLElement>(
      "#app-mobile-layout-tabs",
    ),
    mobileLayoutTabButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        "[data-mobile-layout-tab-button]",
      ),
    ),
    announcementModal: document.querySelector("#app-announcement-modal"),
    announcementBackdrop: document.querySelector("#app-announcement-backdrop"),
    announcementUpdatedAtValue: document.querySelector(
      "#app-announcement-updated-at-value",
    ),
    announcementHistoryList: document.querySelector(
      "#app-announcement-history",
    ),
    announcementKnownIssuesList: document.querySelector(
      "#app-announcement-known-issues",
    ),
    announcementFeedbackGithubLink: document.querySelector(
      "#app-announcement-feedback-github-link",
    ),
    announcementFeedbackAuthorXLink: document.querySelector(
      "#app-announcement-feedback-author-x-link",
    ),
    announcementGithubLink: document.querySelector(
      "#app-announcement-github-link",
    ),
    announcementAuthorXLink: document.querySelector(
      "#app-announcement-author-x-link",
    ),
    announcementDismissButton: document.querySelector(
      "#app-announcement-dismiss-button",
    ),
    announcementCloseButton: document.querySelector(
      "#app-announcement-close-button",
    ),
    announcementOpenButton: document.querySelector(
      "#app-announcement-open-button",
    ),
    manualModal: document.querySelector("#app-manual-modal"),
    manualBackdrop: document.querySelector("#app-manual-backdrop"),
    manualBody: document.querySelector("#app-manual-body"),
    manualDismissButton: document.querySelector("#app-manual-dismiss-button"),
    manualCloseButton: document.querySelector("#app-manual-close-button"),
    manualOpenButton: document.querySelector("#app-manual-open-button"),
    mobileHeaderMenuButton: document.querySelector(
      "#app-mobile-header-menu-button",
    ),
    mobileHeaderMenu: document.querySelector("#app-mobile-header-menu"),
    presetCombobox: document.querySelector("#app-preset-combobox"),
    presetSelect: document.querySelector("#app-preset-select"),
    presetClearButton: document.querySelector("#app-preset-clear-button"),
    presetToggleButton: document.querySelector("#app-preset-toggle-button"),
    presetOptionsPopup: document.querySelector("#app-preset-options-popup"),
    metadataInputs: {
      name: document.querySelector("#app-metadata-name-input"),
      shortDescription: document.querySelector(
        "#app-metadata-short-description-input",
      ),
      altName: document.querySelector("#app-metadata-alt-name-input"),
      description: document.querySelector("#app-metadata-description-input"),
      reference: document.querySelector("#app-metadata-reference-input"),
      fullReference: document.querySelector(
        "#app-metadata-full-reference-input",
      ),
    },
    presetMetadataToggleButton: document.querySelector(
      "#app-preset-metadata-toggle",
    ),
    presetMetadataAdvanced: document.querySelector(
      "#app-preset-metadata-advanced",
    ),
    crystalSystemSelect: document.querySelector("#app-crystal-system-select"),
    sizeInput: document.querySelector("#app-size-mm-input"),
    stlSplitEnabledInput: document.querySelector(
      "#app-stl-split-enabled-input",
    ),
    stlSplitPlaneFields: document.querySelector("#app-stl-split-plane-fields"),
    stlSplitPlaneInputs: {
      h: document.querySelector("#app-stl-split-plane-h-input"),
      k: document.querySelector("#app-stl-split-plane-k-input"),
      i: document.querySelector("#app-stl-split-plane-i-input"),
      l: document.querySelector("#app-stl-split-plane-l-input"),
    },
    stlSplitPlaneIField: document.querySelector("#app-stl-split-plane-i-field"),
    axisInputs: {
      a: document.querySelector("#twin-axis-a-input"),
      b: document.querySelector("#twin-axis-b-input"),
      c: document.querySelector("#twin-axis-c-input"),
    },
    angleInputs: {
      alpha: document.querySelector("#twin-angle-alpha-input"),
      beta: document.querySelector("#twin-angle-beta-input"),
      gamma: document.querySelector("#twin-angle-gamma-input"),
    },
    twinSettingsCard: document.querySelector("#twin-settings-card"),
    twinTypeSelect: document.querySelector("#twin-type-select"),
    twinSettingsNote: document.querySelector("#twin-settings-note"),
    twinSettingsFields: document.querySelector("#twin-settings-fields"),
    fromCrystalSelect: document.querySelector("#twin-from-crystal-select"),
    twinRuleHeading: document.querySelector("#twin-rule-heading"),
    twinRuleInputs: {
      h: document.querySelector("#twin-rule-h-input"),
      k: document.querySelector("#twin-rule-k-input"),
      i: document.querySelector("#twin-rule-i-input"),
      l: document.querySelector("#twin-rule-l-input"),
    },
    twinRuleFields: document.querySelector("#twin-rule-fields"),
    twinRuleIField: document.querySelector("#twin-rule-i-field"),
    twinAxisAngleField: document.querySelector("#twin-axis-angle-field"),
    rotationAngleInput: document.querySelector("#twin-rotation-angle-input"),
    axisOffsetInput: document.querySelector("#twin-axis-offset-input"),
    twinContactFields: document.querySelector("#twin-contact-fields"),
    baseFaceRefSelect: document.querySelector("#twin-base-face-ref-select"),
    derivedFaceRefSelect: document.querySelector(
      "#twin-derived-face-ref-select",
    ),
    contactReferenceAxisSelect: document.querySelector(
      "#twin-contact-reference-axis-select",
    ),
    baseFaceRefLabel: document.querySelector("#twin-base-face-ref-label"),
    derivedFaceRefLabel: document.querySelector("#twin-derived-face-ref-label"),
    messagesPanel: document.querySelector("#app-messages-panel"),
    facesTableHeadRow: document.querySelector("#app-faces-table-head-row"),
    facesTableBody: document.querySelector("#app-faces-table-body"),
    faceMobileToolbar: document.querySelector("#app-face-mobile-toolbar"),
    faceMobileList: document.querySelector("#app-face-mobile-list"),
    addFaceButton: document.querySelector("#app-add-face-button"),
    clearFacesButton: document.querySelector("#app-clear-faces-button"),
    faceCrystalTabsContainer: document.querySelector(".crystal-tab-list"),
    saveButton: document.querySelector("#app-save-button"),
    saveMenu: document.querySelector("#app-save-menu"),
    saveAsButton: document.querySelector("#app-save-as-button"),
    saveAsMenu: document.querySelector("#app-save-as-menu"),
    importJsonButton: document.querySelector("#app-import-json-button"),
    importJsonMenu: document.querySelector("#app-import-json-menu"),
    mobileOutputExportButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".mobile-output-flow [data-export-format][data-save-mode]",
      ),
    ),
    mobileOutputImportButtons: Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        ".mobile-output-flow [data-import-mode]",
      ),
    ),
    importJsonInput: document.querySelector("#app-import-json-input"),
    xrayFaceCanvas: document.querySelector("#app-xray-face-canvas"),
    canvas: document.querySelector("#app-preview-canvas"),
    previewPanel: document.querySelector(".preview-panel"),
    faceLabelLayer: document.querySelector("#app-face-label-layer"),
    presetMetadataOverlay: document.querySelector(
      "#app-preset-metadata-overlay",
    ),
    presetMetadataName: document.querySelector("#app-preset-metadata-name"),
    presetMetadataShortDescription: document.querySelector(
      "#app-preset-metadata-short-description",
    ),
    previewStage: document.querySelector(".preview-stage"),
    faceDisplayModeSelect: document.querySelector(
      "#app-face-display-mode-select",
    ),
    toggleFaceLabelsInput: document.querySelector(
      "#twin-toggle-face-labels-input",
    ),
    crystalVisibilityToggles: document.querySelector(
      "#app-crystal-visibility-toggles",
    ),
    faceSectionCard: document.querySelector(".face-section-card"),
    faceTableWrap: document.querySelector(".face-table-wrap"),
    faceTabsWrap: document.querySelector(".crystal-tab-list-wrap"),
    toggleAxisLabelsInput: document.querySelector(
      "#twin-toggle-axis-labels-input",
    ),
    toggleAxisLinesInnerInput: document.querySelector(
      "#twin-toggle-axis-lines-inner-input",
    ),
    toggleAxisLinesOuterInput: document.querySelector(
      "#twin-toggle-axis-lines-outer-input",
    ),
    toggleTwinRuleInput: document.querySelector("#twin-toggle-twin-rule-input"),
    toggleRidgeLinesInput: document.querySelector(
      "#twin-toggle-ridge-lines-input",
    ),
    toggleIntersectionRidgeLinesInput: document.querySelector(
      "#twin-toggle-intersection-ridge-lines-input",
    ),
    togglePresetMetadataInput: document.querySelector(
      "#twin-toggle-preset-metadata-input",
    ),
    toggleSplitPlaneInput: document.querySelector(
      "#twin-toggle-split-plane-input",
    ),
    previewStyleDetails: document.querySelector("#app-preview-style-details"),
    previewStylePanel: document.querySelector("#app-preview-style-panel"),
    downloadPreviewDebugButton: document.querySelector(
      "#app-download-preview-debug-button",
    ),
    toggleInertiaInput: document.querySelector("#twin-toggle-inertia-input"),
    axisViewButtons: document.querySelector("#app-axis-view-buttons"),
    resetPreviewButton: document.querySelector("#app-reset-preview-button"),
    tabMenuPopover: document.querySelector("#app-tab-menu-popover"),
  };
}
