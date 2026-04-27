interface HelpOptions {
  disabledHelpKey?: string;
  label?: string;
}

interface FieldHelpTarget {
  selector: string;
  helpKey: string;
  disabledHelpKey?: string;
  label?: string;
}

const fieldHelpTargets: FieldHelpTarget[] = [
  { selector: "#app-locale-select", helpKey: "help.language" },
  { selector: "#app-preset-select", helpKey: "help.preset.query" },
  {
    selector: "#app-metadata-name-input",
    helpKey: "help.preset.metadata.name",
  },
  {
    selector: "#app-metadata-short-description-input",
    helpKey: "help.preset.metadata.shortDescription",
  },
  {
    selector: "#app-metadata-alt-name-input",
    helpKey: "help.preset.metadata.altName",
  },
  {
    selector: "#app-metadata-description-input",
    helpKey: "help.preset.metadata.description",
  },
  {
    selector: "#app-metadata-reference-input",
    helpKey: "help.preset.metadata.reference",
  },
  {
    selector: "#app-metadata-full-reference-input",
    helpKey: "help.preset.metadata.fullReference",
  },
  { selector: "#app-crystal-system-select", helpKey: "help.crystal.system" },
  { selector: "#app-size-mm-input", helpKey: "help.crystal.size" },
  {
    selector: "#twin-axis-a-input",
    helpKey: "help.crystal.axisRatio",
    disabledHelpKey: "help.disabled.crystalSystemLocked",
    label: "a",
  },
  {
    selector: "#twin-axis-b-input",
    helpKey: "help.crystal.axisRatio",
    disabledHelpKey: "help.disabled.crystalSystemLocked",
    label: "b",
  },
  {
    selector: "#twin-axis-c-input",
    helpKey: "help.crystal.axisRatio",
    disabledHelpKey: "help.disabled.crystalSystemLocked",
    label: "c",
  },
  {
    selector: "#twin-angle-alpha-input",
    helpKey: "help.crystal.axisAngle",
    disabledHelpKey: "help.disabled.crystalSystemLocked",
    label: "α",
  },
  {
    selector: "#twin-angle-beta-input",
    helpKey: "help.crystal.axisAngle",
    disabledHelpKey: "help.disabled.crystalSystemLocked",
    label: "β",
  },
  {
    selector: "#twin-angle-gamma-input",
    helpKey: "help.crystal.axisAngle",
    disabledHelpKey: "help.disabled.crystalSystemLocked",
    label: "γ",
  },
  {
    selector: "#app-stl-split-enabled-input",
    helpKey: "help.stlSplit.enabled",
  },
  {
    selector: "#app-stl-split-plane-h-input",
    helpKey: "help.stlSplit.planeIndex",
    label: "h",
  },
  {
    selector: "#app-stl-split-plane-k-input",
    helpKey: "help.stlSplit.planeIndex",
    label: "k",
  },
  {
    selector: "#app-stl-split-plane-i-input",
    helpKey: "help.stlSplit.planeIndex",
    disabledHelpKey: "help.disabled.autoI",
    label: "i",
  },
  {
    selector: "#app-stl-split-plane-l-input",
    helpKey: "help.stlSplit.planeIndex",
    label: "l",
  },
  { selector: "#twin-from-crystal-select", helpKey: "help.twin.fromCrystal" },
  { selector: "#twin-type-select", helpKey: "help.twin.type" },
  {
    selector: "#twin-rule-h-input",
    helpKey: "help.twin.ruleIndex",
    label: "h",
  },
  {
    selector: "#twin-rule-k-input",
    helpKey: "help.twin.ruleIndex",
    label: "k",
  },
  {
    selector: "#twin-rule-i-input",
    helpKey: "help.twin.ruleIndex",
    disabledHelpKey: "help.disabled.autoI",
    label: "i",
  },
  {
    selector: "#twin-rule-l-input",
    helpKey: "help.twin.ruleIndex",
    label: "l",
  },
  { selector: "#twin-rotation-angle-input", helpKey: "help.twin.rotation" },
  {
    selector: "#twin-base-face-ref-select",
    helpKey: "help.twin.baseContactFace",
  },
  {
    selector: "#twin-derived-face-ref-select",
    helpKey: "help.twin.derivedContactFace",
  },
  {
    selector: "#twin-contact-reference-axis-select",
    helpKey: "help.twin.referenceAxis",
  },
  {
    selector: "#app-face-display-mode-select",
    helpKey: "help.preview.faceDisplay",
  },
  {
    selector: "#twin-toggle-inertia-input",
    helpKey: "help.preview.inertia",
  },
  {
    selector: "#twin-toggle-face-labels-input",
    helpKey: "help.preview.toggle.faceLabels",
  },
  {
    selector: "#twin-toggle-ridge-lines-input",
    helpKey: "help.preview.toggle.ridgeLines",
  },
  {
    selector: "#twin-toggle-intersection-ridge-lines-input",
    helpKey: "help.preview.toggle.intersectionLines",
  },
  {
    selector: "#twin-toggle-axis-lines-inner-input",
    helpKey: "help.preview.toggle.axisInner",
  },
  {
    selector: "#twin-toggle-axis-lines-outer-input",
    helpKey: "help.preview.toggle.axisOuter",
  },
  {
    selector: "#twin-toggle-axis-labels-input",
    helpKey: "help.preview.toggle.axisLabels",
  },
  {
    selector: "#twin-toggle-twin-rule-input",
    helpKey: "help.preview.toggle.twinRule",
  },
  {
    selector: "#twin-toggle-preset-metadata-input",
    helpKey: "help.preview.toggle.metadata",
  },
  {
    selector: "#twin-toggle-split-plane-input",
    helpKey: "help.preview.toggle.splitPlane",
  },
];

const buttonHelpTargets: FieldHelpTarget[] = [
  { selector: "#app-announcement-github-link", helpKey: "help.header.github" },
  { selector: "#app-announcement-author-x-link", helpKey: "help.header.x" },
  { selector: "#app-announcement-open-button", helpKey: "help.header.notice" },
  { selector: "#app-manual-open-button", helpKey: "help.header.manual" },
  { selector: "#app-mobile-header-menu-button", helpKey: "help.header.menu" },
  { selector: "#app-save-button", helpKey: "help.header.save" },
  { selector: "#app-save-as-button", helpKey: "help.header.saveAs" },
  { selector: "#app-import-json-button", helpKey: "help.header.import" },
  { selector: "#app-preset-clear-button", helpKey: "help.preset.clear" },
  { selector: "#app-preset-toggle-button", helpKey: "help.preset.options" },
  {
    selector: "#app-preset-metadata-toggle",
    helpKey: "help.preset.metadataToggle",
  },
  { selector: "#app-reset-preview-button", helpKey: "help.preview.reset" },
  {
    selector: "#app-add-crystal-tab",
    helpKey: "help.crystal.add",
    disabledHelpKey: "help.disabled.maxCrystals",
  },
  {
    selector: "[data-mobile-face-action='clear']",
    helpKey: "help.face.clearAll",
    disabledHelpKey: "help.disabled.noFaces",
  },
  { selector: "[data-mobile-face-action='add']", helpKey: "help.face.add" },
  {
    selector: "#app-clear-faces-button",
    helpKey: "help.face.clearAll",
    disabledHelpKey: "help.disabled.noFaces",
  },
  { selector: "#app-add-face-button", helpKey: "help.face.add" },
  {
    selector: "[data-preview-style-reset-scope='basic']",
    helpKey: "help.previewStyle.resetBasic",
  },
  {
    selector: "[data-preview-style-reset-scope='advanced']",
    helpKey: "help.previewStyle.resetAdvanced",
  },
  {
    selector: "#app-announcement-dismiss-button",
    helpKey: "help.modal.dismiss",
  },
  { selector: "#app-announcement-close-button", helpKey: "help.modal.close" },
  { selector: "#app-manual-dismiss-button", helpKey: "help.modal.dismiss" },
  { selector: "#app-manual-close-button", helpKey: "help.modal.close" },
];

const exportHelpKeys = {
  json: "help.export.json",
  stl: "help.export.stl",
  svg: "help.export.svg",
  png: "help.export.png",
  jpeg: "help.export.jpeg",
} as const;

const importHelpKeys = {
  both: "help.import.all",
  "crystal-only": "help.import.crystal",
  "preview-only": "help.import.preview",
} as const;

function setHelp(element: Element | null, helpKey: string, options = {}) {
  if (!(element instanceof HTMLElement)) {
    return;
  }
  const helpOptions = options as HelpOptions;
  element.dataset.helpKey = helpKey;
  if (helpOptions.disabledHelpKey) {
    element.dataset.disabledHelpKey = helpOptions.disabledHelpKey;
  }
  if (helpOptions.label) {
    element.dataset.helpLabel = helpOptions.label;
  }
}

function setFieldHelp(
  element: Element | null,
  helpKey: string,
  options: HelpOptions = {},
) {
  setHelp(element, helpKey, options);
  if (element instanceof HTMLElement) {
    setHelp(element.closest("label"), helpKey, options);
  }
}

function applyTargetList(root: ParentNode, targets: FieldHelpTarget[]) {
  targets.forEach((target) => {
    root.querySelectorAll(target.selector).forEach((element) => {
      setFieldHelp(element, target.helpKey, {
        disabledHelpKey: target.disabledHelpKey,
        label: target.label,
      });
    });
  });
}

function applyButtonTargetList(root: ParentNode, targets: FieldHelpTarget[]) {
  targets.forEach((target) => {
    root.querySelectorAll(target.selector).forEach((element) => {
      setHelp(element, target.helpKey, {
        disabledHelpKey: target.disabledHelpKey,
        label: target.label,
      });
    });
  });
}

function applyExportImportHelp(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>("[data-export-format]")
    .forEach((button) => {
      const key =
        exportHelpKeys[
          button.dataset.exportFormat as keyof typeof exportHelpKeys
        ];
      if (key) {
        setHelp(button, key);
      }
    });
  root.querySelectorAll<HTMLElement>("[data-import-mode]").forEach((button) => {
    const key =
      importHelpKeys[button.dataset.importMode as keyof typeof importHelpKeys];
    if (key) {
      setHelp(button, key);
    }
  });
}

function applyFaceTableHelp(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>(".face-table-sort-button")
    .forEach((button) => {
      setHelp(button, "help.face.sort", {
        label:
          button.getAttribute("aria-label") ??
          button.dataset.sortField ??
          "column",
      });
    });
  root
    .querySelectorAll<HTMLElement>(".face-enabled-toggle")
    .forEach((label) => {
      setHelp(label, "help.face.enabledToggle");
    });
  root.querySelectorAll<HTMLElement>(".face-group-toggle").forEach((button) => {
    setHelp(button, "help.face.groupToggle");
  });
  root
    .querySelectorAll<HTMLElement>(".toggle-face-text-button")
    .forEach((button) => {
      setHelp(button, "help.face.textToggle");
    });
  root
    .querySelectorAll<HTMLElement>(".equivalent-face-button")
    .forEach((button) => {
      setHelp(button, "help.face.equivalent", {
        disabledHelpKey: "help.disabled.noEquivalentFaces",
      });
    });
  root
    .querySelectorAll<HTMLElement>(".remove-face-button")
    .forEach((button) => {
      setHelp(button, "help.face.remove");
    });
  root
    .querySelectorAll<HTMLElement>(".face-color-field input")
    .forEach((input) => {
      setFieldHelp(input, "help.face.color");
    });
  root.querySelectorAll<HTMLElement>(".face-index-input").forEach((input) => {
    const field = input.dataset.faceField ?? "";
    setFieldHelp(input, `help.face.index.${field}`, {
      disabledHelpKey:
        field === "i"
          ? "help.disabled.faceIndexIReadonly"
          : "help.disabled.faceGroupCollapsed",
      label: field,
    });
  });
  root
    .querySelectorAll<HTMLElement>(
      ".face-row input[data-face-field='i'], .face-mobile-card input[data-face-field='i']",
    )
    .forEach((input) => {
      setFieldHelp(input, "help.face.index.i", {
        disabledHelpKey: "help.disabled.faceIndexIReadonly",
        label: "i",
      });
    });
  root
    .querySelectorAll<HTMLElement>(".face-index-spin-button")
    .forEach((button) => {
      setHelp(button, "help.face.indexStep", {
        disabledHelpKey: "help.disabled.faceGroupCollapsed",
        label: button.dataset.faceIndexField ?? "",
      });
    });
  root.querySelectorAll<HTMLElement>(".coefficient-input").forEach((input) => {
    setFieldHelp(input, "help.face.coefficient");
  });
  root
    .querySelectorAll<HTMLElement>(".coefficient-spin-button")
    .forEach((button) => {
      setHelp(button, "help.face.coefficientStep");
    });
  root
    .querySelectorAll<HTMLElement>("[data-face-text-field]")
    .forEach((input) => {
      setFieldHelp(input, "help.faceText.field");
    });
}

function applyDynamicPageHelp(root: ParentNode) {
  root
    .querySelectorAll<HTMLElement>("[data-mobile-layout-tab-button]")
    .forEach((button) => {
      setHelp(button, "help.mobile.tab");
    });
  root
    .querySelectorAll<HTMLElement>("[data-mobile-layout-tab-target]")
    .forEach((button) => {
      setHelp(button, "help.mobile.menuTab");
    });
  root.querySelectorAll<HTMLElement>("[data-set-locale]").forEach((button) => {
    setHelp(button, "help.language");
  });
  root
    .querySelectorAll<HTMLElement>(".preview-axis-view-button")
    .forEach((button) => {
      setHelp(button, "help.preview.axisView", {
        label: button.dataset.axisLabel ?? button.textContent?.trim() ?? "",
      });
    });
  root
    .querySelectorAll<HTMLElement>(".crystal-tab:not(.crystal-tab-add)")
    .forEach((button) => {
      setHelp(button, "help.crystal.tab");
    });
  root
    .querySelectorAll<HTMLElement>(".crystal-tab-menu-trigger")
    .forEach((button) => {
      setHelp(button, "help.crystal.menu");
    });
  root
    .querySelectorAll<HTMLElement>(".crystal-visibility-input")
    .forEach((input) => {
      setFieldHelp(input, "help.preview.crystalVisibility", {
        disabledHelpKey: "help.disabled.hiddenCrystal",
      });
    });
  root
    .querySelectorAll<HTMLElement>("[data-preview-style-key]")
    .forEach((control) => {
      setFieldHelp(control, "help.previewStyle.field", {
        disabledHelpKey: "help.disabled.hiddenByCrystalSystem",
      });
    });
  root
    .querySelectorAll<HTMLElement>("#app-preview-style-details > summary")
    .forEach((summary) => {
      setHelp(summary, "help.previewStyle.summary");
    });
  root
    .querySelectorAll<HTMLElement>(".crystal-tab-menu-action")
    .forEach((button) => {
      const action = button.dataset.tabAction;
      if (action === "duplicate") {
        setHelp(button, "help.crystal.duplicate");
        return;
      }
      if (action === "delete") {
        setHelp(button, "help.crystal.delete", {
          disabledHelpKey: "help.disabled.baseCrystal",
        });
      }
    });
  root
    .querySelectorAll<HTMLElement>("[data-crystal-color-index]")
    .forEach((input) => {
      setFieldHelp(input, "help.crystal.color");
    });
}

export function applyControlHelpAttributes(root: ParentNode = document) {
  applyTargetList(root, fieldHelpTargets);
  applyButtonTargetList(root, buttonHelpTargets);
  applyExportImportHelp(root);
  applyFaceTableHelp(root);
  applyDynamicPageHelp(root);
}
