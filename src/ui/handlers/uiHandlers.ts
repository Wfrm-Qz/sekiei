import { findHeaderActionMenuItem } from "../headerActionMenu.js";

/**
 * UI event handler 登録のうち、比較的安全に外出しできる塊をまとめる module。
 *
 * ここでは preset combobox、metadata、header save menu のように DOM 契約が比較的明確で、
 * preview 幾何や face table の複雑な state 遷移へ直接触れない配線を扱う。
 */

interface TwinPresetDescriptorLike {
  label: string;
  parameters?: unknown;
}

interface TwinUiHandlerStateLike {
  presetQuery: string;
  presetPopupOpen?: boolean;
  presetMetadataExpanded?: boolean;
}

interface TwinUiHandlerElementsLike {
  localeSelect?: HTMLSelectElement | null;
  presetSelect: HTMLInputElement;
  presetClearButton: HTMLButtonElement;
  presetToggleButton: HTMLButtonElement;
  presetCombobox: HTMLElement;
  presetMetadataToggleButton: HTMLButtonElement;
  metadataInputs: Record<string, HTMLInputElement | HTMLTextAreaElement>;
  announcementOpenButton?: HTMLButtonElement | null;
  mobileHeaderMenuButton?: HTMLButtonElement | null;
  mobileHeaderMenu?: HTMLElement | null;
  saveButton?: HTMLButtonElement | null;
  saveAsButton?: HTMLButtonElement | null;
  saveMenu?: HTMLElement | null;
  saveAsMenu?: HTMLElement | null;
  importJsonButton?: HTMLButtonElement | null;
  importJsonMenu?: HTMLElement | null;
  mobileOutputExportButtons?: HTMLButtonElement[];
  mobileOutputImportButtons?: HTMLButtonElement[];
  importJsonInput?: HTMLInputElement | null;
}

export interface TwinUiHandlersContext {
  state: TwinUiHandlerStateLike;
  elements: TwinUiHandlerElementsLike;
  findPresetFromQuery: (query: string) => TwinPresetDescriptorLike | null;
  applyCustomPresetSelection: (label?: string) => void;
  applyTwinPreset: (preset: TwinPresetDescriptorLike) => void;
  syncPresetInputUi: () => void;
  openPresetPopup: () => void;
  closePresetPopup: () => void;
  closeHeaderSaveMenus: () => void;
  toggleHeaderSaveMenu: (
    button?: HTMLButtonElement | null,
    menu?: HTMLElement | null,
  ) => void;
  openAnnouncementModal: () => void;
  setMobileLayoutTab?: (
    tab: "basic" | "face" | "twin" | "display" | "output",
  ) => void;
  triggerImportJsonWithMode: (
    mode: "both" | "preview-only" | "crystal-only",
  ) => void;
  setLocale?: (locale: "ja" | "en") => void;
  commitMetadataField: (fieldName: string, value: string) => void;
  applyPresetMetadataSectionVisibility: () => void;
  exportTwinArtifact: (
    format: "json" | "stl" | "svg" | "png" | "jpeg",
    saveMode: "save" | "save-as",
  ) => Promise<void>;
}

function isExportFormat(
  value: string | undefined,
): value is "json" | "stl" | "svg" | "png" | "jpeg" {
  return ["json", "stl", "svg", "png", "jpeg"].includes(value ?? "");
}

function isSaveMode(value: string | undefined): value is "save" | "save-as" {
  return value === "save" || value === "save-as";
}

function isImportMode(
  value: string | undefined,
): value is "both" | "preview-only" | "crystal-only" {
  return (
    value === "both" || value === "preview-only" || value === "crystal-only"
  );
}

function isMobileLayoutTabTarget(
  value: string | undefined,
): value is "basic" | "face" | "twin" | "display" | "output" {
  return ["basic", "face", "twin", "display", "output"].includes(value ?? "");
}

function isSupportedLocale(value: string | undefined): value is "ja" | "en" {
  return value === "ja" || value === "en";
}

/** preset / metadata / save menu の登録関数群を返す。 */
export function createTwinUiHandlers(context: TwinUiHandlersContext) {
  async function runUiAction(action: HTMLElement) {
    context.closeHeaderSaveMenus();

    if (action.dataset.openAnnouncement === "true") {
      context.openAnnouncementModal();
      return;
    }

    const mobileLayoutTabTarget = action.dataset.mobileLayoutTabTarget;
    if (isMobileLayoutTabTarget(mobileLayoutTabTarget)) {
      context.setMobileLayoutTab?.(mobileLayoutTabTarget);
      return;
    }

    const locale = action.dataset.setLocale;
    if (isSupportedLocale(locale)) {
      context.setLocale?.(locale);
      return;
    }

    const exportFormat = action.dataset.exportFormat;
    const saveMode = action.dataset.saveMode;
    if (isExportFormat(exportFormat) && isSaveMode(saveMode)) {
      await context.exportTwinArtifact(exportFormat, saveMode);
      return;
    }

    const importMode = action.dataset.importMode;
    if (isImportMode(importMode)) {
      context.triggerImportJsonWithMode(importMode);
    }
  }

  /** preset combobox と metadata input の handler を登録する。 */
  function registerPresetAndMetadataHandlers() {
    context.elements.presetSelect.addEventListener("change", () => {
      context.state.presetQuery = context.elements.presetSelect.value;
      const preset = context.findPresetFromQuery(
        context.elements.presetSelect.value,
      );
      if (!preset?.parameters) {
        context.applyCustomPresetSelection(preset?.label);
        return;
      }
      context.state.presetQuery = preset.label;
      context.applyTwinPreset(preset);
    });

    context.elements.presetSelect.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        context.openPresetPopup();
        return;
      }
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      const preset = context.findPresetFromQuery(
        context.elements.presetSelect.value,
      );
      if (!preset?.parameters) {
        context.applyCustomPresetSelection(preset?.label);
        context.closePresetPopup();
        return;
      }
      context.state.presetQuery = preset.label;
      context.applyTwinPreset(preset);
      context.closePresetPopup();
    });

    context.elements.presetSelect.addEventListener("input", () => {
      context.state.presetQuery = context.elements.presetSelect.value;
      context.openPresetPopup();
    });

    context.elements.presetSelect.addEventListener("focus", () => {
      context.openPresetPopup();
    });

    context.elements.presetClearButton.addEventListener("click", () => {
      context.state.presetQuery = "";
      context.syncPresetInputUi();
      context.elements.presetSelect.focus();
      context.openPresetPopup();
    });

    context.elements.presetToggleButton.addEventListener("click", () => {
      if (context.state.presetPopupOpen) {
        context.closePresetPopup();
        return;
      }
      context.elements.presetSelect.focus();
      context.openPresetPopup();
    });

    document.addEventListener("mousedown", (event) => {
      if (context.elements.presetCombobox.contains(event.target as Node)) {
        context.closeHeaderSaveMenus();
        return;
      }
      context.closePresetPopup();
      if ((event.target as HTMLElement | null)?.closest(".header-menu-wrap")) {
        return;
      }
      context.closeHeaderSaveMenus();
    });

    Object.entries(context.elements.metadataInputs).forEach(
      ([fieldName, input]) => {
        input.addEventListener("input", () => {
          context.commitMetadataField(fieldName, input.value);
        });
      },
    );

    context.elements.presetMetadataToggleButton.addEventListener(
      "click",
      () => {
        context.state.presetMetadataExpanded =
          !context.state.presetMetadataExpanded;
        context.applyPresetMetadataSectionVisibility();
      },
    );
  }

  /** ヘッダー保存メニューの開閉と click action を登録する。 */
  function registerHeaderSaveHandlers() {
    context.elements.announcementOpenButton?.addEventListener("click", () => {
      context.closeHeaderSaveMenus();
      context.openAnnouncementModal();
    });

    context.elements.saveButton?.addEventListener("click", () => {
      context.toggleHeaderSaveMenu(
        context.elements.saveButton,
        context.elements.saveMenu,
      );
    });

    context.elements.saveAsButton?.addEventListener("click", () => {
      context.toggleHeaderSaveMenu(
        context.elements.saveAsButton,
        context.elements.saveAsMenu,
      );
    });

    context.elements.importJsonButton?.addEventListener("click", () => {
      context.toggleHeaderSaveMenu(
        context.elements.importJsonButton,
        context.elements.importJsonMenu,
      );
    });

    context.elements.mobileHeaderMenuButton?.addEventListener("click", () => {
      context.toggleHeaderSaveMenu(
        context.elements.mobileHeaderMenuButton,
        context.elements.mobileHeaderMenu,
      );
    });

    const handleHeaderSaveMenuClick = async (event: Event) => {
      const action = findHeaderActionMenuItem(event.target);
      if (!action) {
        return;
      }
      await runUiAction(action);
    };

    context.elements.saveMenu?.addEventListener(
      "click",
      handleHeaderSaveMenuClick,
    );
    context.elements.saveAsMenu?.addEventListener(
      "click",
      handleHeaderSaveMenuClick,
    );
    context.elements.importJsonMenu?.addEventListener(
      "click",
      handleHeaderSaveMenuClick,
    );
    context.elements.mobileHeaderMenu?.addEventListener(
      "click",
      handleHeaderSaveMenuClick,
    );

    context.elements.mobileOutputExportButtons?.forEach((button) => {
      button.addEventListener("click", () => {
        void runUiAction(button);
      });
    });
    context.elements.mobileOutputImportButtons?.forEach((button) => {
      button.addEventListener("click", () => {
        void runUiAction(button);
      });
    });
  }

  return {
    registerPresetAndMetadataHandlers,
    registerHeaderSaveHandlers,
  };
}
