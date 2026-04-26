import { describe, expect, it, vi } from "vitest";
import { createTwinUiHandlers } from "../../../../src/ui/handlers/uiHandlers.ts";

/**
 * ui/uiHandlers の preset / metadata / save menu 配線を確認する unit test。
 */
describe("ui/uiHandlers", () => {
  function createContext() {
    document.body.innerHTML = `
      <div id="preset-combobox">
        <input id="preset-select" />
        <button id="clear"></button>
        <button id="toggle"></button>
        <div id="popup"></div>
      </div>
      <button id="metadata-toggle"></button>
      <input id="metadata-name" />
      <button id="announcement-open"></button>
      <button id="mobile-menu-button"></button>
      <div id="mobile-menu">
        <button class="header-action-menu-item" data-open-announcement="true">updates</button>
      </div>
      <button id="save"></button>
      <div id="save-menu"><button class="header-action-menu-item" data-export-format="json" data-save-mode="save">save</button></div>
      <button id="save-as"></button>
      <div id="save-as-menu"><button class="header-action-menu-item" data-export-format="png" data-save-mode="save-as">save as</button></div>
      <button id="mobile-export" data-export-format="svg" data-save-mode="save">svg</button>
      <button id="mobile-import" data-import-mode="preview-only">preview</button>
    `;

    return {
      state: {
        presetQuery: "",
        presetPopupOpen: false,
        presetMetadataExpanded: false,
      },
      elements: {
        presetSelect: document.getElementById(
          "preset-select",
        ) as HTMLInputElement,
        presetClearButton: document.getElementById(
          "clear",
        ) as HTMLButtonElement,
        presetToggleButton: document.getElementById(
          "toggle",
        ) as HTMLButtonElement,
        presetCombobox: document.getElementById(
          "preset-combobox",
        ) as HTMLElement,
        presetMetadataToggleButton: document.getElementById(
          "metadata-toggle",
        ) as HTMLButtonElement,
        metadataInputs: {
          name: document.getElementById("metadata-name") as HTMLInputElement,
        },
        announcementOpenButton: document.getElementById(
          "announcement-open",
        ) as HTMLButtonElement,
        mobileHeaderMenuButton: document.getElementById(
          "mobile-menu-button",
        ) as HTMLButtonElement,
        mobileHeaderMenu: document.getElementById("mobile-menu") as HTMLElement,
        saveButton: document.getElementById("save") as HTMLButtonElement,
        saveAsButton: document.getElementById("save-as") as HTMLButtonElement,
        saveMenu: document.getElementById("save-menu") as HTMLElement,
        saveAsMenu: document.getElementById("save-as-menu") as HTMLElement,
        mobileOutputExportButtons: [
          document.getElementById("mobile-export") as HTMLButtonElement,
        ],
        mobileOutputImportButtons: [
          document.getElementById("mobile-import") as HTMLButtonElement,
        ],
      },
      findPresetFromQuery: vi.fn(),
      applyCustomPresetSelection: vi.fn(),
      applyTwinPreset: vi.fn(),
      syncPresetInputUi: vi.fn(),
      openPresetPopup: vi.fn(),
      closePresetPopup: vi.fn(),
      closeHeaderSaveMenus: vi.fn(),
      toggleHeaderSaveMenu: vi.fn(),
      openAnnouncementModal: vi.fn(),
      triggerImportJsonWithMode: vi.fn(),
      commitMetadataField: vi.fn(),
      applyPresetMetadataSectionVisibility: vi.fn(),
      exportTwinArtifact: vi.fn(async () => undefined),
    };
  }

  it("registerPresetAndMetadataHandlers は preset 適用と metadata 更新を配線する", () => {
    const context = createContext();
    const handlers = createTwinUiHandlers(context);
    handlers.registerPresetAndMetadataHandlers();

    context.findPresetFromQuery.mockReturnValueOnce({ label: "Custom" });
    context.elements.presetSelect.value = "Custom";
    context.elements.presetSelect.dispatchEvent(new Event("change"));
    expect(context.applyCustomPresetSelection).toHaveBeenCalledWith("Custom");

    context.findPresetFromQuery.mockReturnValueOnce({
      label: "Corundum",
      parameters: { crystals: [{ id: "base" }, { id: "derived" }] },
    });
    context.elements.presetSelect.value = "Corundum";
    context.elements.presetSelect.dispatchEvent(new Event("change"));
    expect(context.state.presetQuery).toBe("Corundum");
    expect(context.applyTwinPreset).toHaveBeenCalled();

    context.elements.metadataInputs.name.value = "updated";
    context.elements.metadataInputs.name.dispatchEvent(new Event("input"));
    expect(context.commitMetadataField).toHaveBeenCalledWith("name", "updated");

    context.elements.presetMetadataToggleButton.click();
    expect(context.state.presetMetadataExpanded).toBe(true);
    expect(context.applyPresetMetadataSectionVisibility).toHaveBeenCalled();
  });

  it("registerHeaderSaveHandlers は save menu 開閉と export action を配線する", async () => {
    const context = createContext();
    const handlers = createTwinUiHandlers(context);
    handlers.registerHeaderSaveHandlers();

    context.elements.announcementOpenButton.click();
    expect(context.closeHeaderSaveMenus).toHaveBeenCalledTimes(1);
    expect(context.openAnnouncementModal).toHaveBeenCalledTimes(1);

    context.elements.saveButton.click();
    expect(context.toggleHeaderSaveMenu).toHaveBeenCalledWith(
      context.elements.saveButton,
      context.elements.saveMenu,
    );

    context.elements.mobileHeaderMenuButton.click();
    expect(context.toggleHeaderSaveMenu).toHaveBeenCalledWith(
      context.elements.mobileHeaderMenuButton,
      context.elements.mobileHeaderMenu,
    );

    const menuItem = context.elements.saveMenu.querySelector(
      ".header-action-menu-item",
    ) as HTMLButtonElement;
    menuItem.click();

    expect(context.closeHeaderSaveMenus).toHaveBeenCalled();
    expect(context.exportTwinArtifact).toHaveBeenCalledWith("json", "save");

    const mobileMenuItem = context.elements.mobileHeaderMenu?.querySelector(
      ".header-action-menu-item",
    ) as HTMLButtonElement;
    mobileMenuItem.click();
    expect(context.openAnnouncementModal).toHaveBeenCalledTimes(2);

    context.elements.mobileOutputExportButtons?.[0]?.click();
    expect(context.exportTwinArtifact).toHaveBeenCalledWith("svg", "save");

    context.elements.mobileOutputImportButtons?.[0]?.click();
    expect(context.triggerImportJsonWithMode).toHaveBeenCalledWith(
      "preview-only",
    );
  });
});
