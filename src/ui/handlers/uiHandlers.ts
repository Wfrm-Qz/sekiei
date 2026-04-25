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
  presetSelect: HTMLInputElement;
  presetClearButton: HTMLButtonElement;
  presetToggleButton: HTMLButtonElement;
  presetCombobox: HTMLElement;
  presetMetadataToggleButton: HTMLButtonElement;
  metadataInputs: Record<string, HTMLInputElement | HTMLTextAreaElement>;
  announcementOpenButton?: HTMLButtonElement | null;
  saveButton?: HTMLButtonElement | null;
  saveAsButton?: HTMLButtonElement | null;
  saveMenu?: HTMLElement | null;
  saveAsMenu?: HTMLElement | null;
  importJsonButton?: HTMLButtonElement | null;
  importJsonMenu?: HTMLElement | null;
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
  triggerImportJsonWithMode: (
    mode: "both" | "preview-only" | "crystal-only",
  ) => void;
  commitMetadataField: (fieldName: string, value: string) => void;
  applyPresetMetadataSectionVisibility: () => void;
  exportTwinArtifact: (
    format: "json" | "stl" | "svg" | "png" | "jpeg",
    saveMode: "save" | "save-as",
  ) => Promise<void>;
}

/** preset / metadata / save menu の登録関数群を返す。 */
export function createTwinUiHandlers(context: TwinUiHandlersContext) {
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

    const handleHeaderSaveMenuClick = async (event: Event) => {
      const action = findHeaderActionMenuItem(event.target);
      if (!action) {
        return;
      }
      context.closeHeaderSaveMenus();
      await context.exportTwinArtifact(
        action.dataset.exportFormat as "json" | "stl" | "svg" | "png" | "jpeg",
        action.dataset.saveMode as "save" | "save-as",
      );
    };

    context.elements.saveMenu?.addEventListener(
      "click",
      handleHeaderSaveMenuClick,
    );
    context.elements.saveAsMenu?.addEventListener(
      "click",
      handleHeaderSaveMenuClick,
    );

    context.elements.importJsonMenu?.addEventListener("click", (event) => {
      const action = findHeaderActionMenuItem(event.target);
      if (!action) {
        return;
      }
      context.closeHeaderSaveMenus();
      const mode = action.dataset.importMode;
      context.triggerImportJsonWithMode(
        mode === "preview-only" || mode === "crystal-only" || mode === "both"
          ? mode
          : "both",
      );
    });
  }

  return {
    registerPresetAndMetadataHandlers,
    registerHeaderSaveHandlers,
  };
}
