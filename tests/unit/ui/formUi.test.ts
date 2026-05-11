import { describe, expect, it, vi } from "vitest";
import { createDefaultTwinParameters } from "../../../src/domain/parameters.ts";
import { createPageUiActions } from "../../../src/ui/formUi.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import { createDefaultTwinStlSplitSettings } from "../../../src/state/stlSplitSettings.ts";

/**
 * ui/formUi の公開 action 群を、重い preview 依存を避けつつ確認する unit test。
 */
describe("ui/formUi", () => {
  function mountElements() {
    document.body.innerHTML = `
      <select id="crystal-system"></select>
      <div id="preset-options-popup"></div>
      <input id="preset-select" />
      <button id="preset-clear"></button>
      <button id="preset-toggle"></button>
      <input id="metadata-name" />
      <input id="metadata-alt-name" />
      <input id="metadata-short-description" />
      <textarea id="metadata-description"></textarea>
      <textarea id="metadata-reference"></textarea>
      <textarea id="metadata-full-reference"></textarea>
      <input id="size" />
      <input id="stl-split-enabled" type="checkbox" />
      <div id="stl-split-fields"></div>
      <input id="stl-split-h" />
      <input id="stl-split-k" />
      <input id="stl-split-i" />
      <input id="stl-split-l" />
      <div id="stl-split-i-field"></div>
      <select id="twin-type"><option value="penetration">penetration</option></select>
      <select id="from-crystal"></select>
      <select id="base-face"></select>
      <select id="derived-face"></select>
      <select id="contact-axis"></select>
      <input id="rotation" />
      <input id="axis-offset" />
      <div id="head-row"></div>
      <div id="twin-settings-card"></div>
      <div id="twin-settings-note"></div>
      <div id="twin-settings-fields"></div>
      <div id="twin-rule-heading"></div>
      <div id="twin-rule-fields"></div>
      <div id="twin-rule-i-field"></div>
      <div id="twin-axis-angle-field"></div>
      <div id="twin-contact-fields"></div>
      <div id="base-face-ref-label"></div>
      <div id="derived-face-ref-label"></div>
      <div id="face-crystal-tabs"></div>
      <div id="face-tabs-wrap"></div>
      <div id="face-table-wrap"></div>
      <div id="crystal-visibility"></div>
      <div id="axis-view-buttons"></div>
      <select id="face-display-mode"><option value="solid">solid</option></select>
      <input id="toggle-face-labels" type="checkbox" />
      <input id="toggle-axis-labels" type="checkbox" />
      <input id="toggle-axis-lines-inner" type="checkbox" />
      <input id="toggle-axis-lines-outer" type="checkbox" />
      <input id="toggle-twin-rule" type="checkbox" />
      <input id="toggle-ridge-lines" type="checkbox" />
      <input id="toggle-intersection-ridge-lines" type="checkbox" />
      <input id="toggle-preset-metadata" type="checkbox" />
      <input id="toggle-split-plane" type="checkbox" />
      <input id="toggle-inertia" type="checkbox" />
    `;

    return {
      crystalSystemSelect: document.getElementById("crystal-system"),
      presetOptionsPopup: document.getElementById("preset-options-popup"),
      presetSelect: document.getElementById("preset-select"),
      presetClearButton: document.getElementById("preset-clear"),
      presetToggleButton: document.getElementById("preset-toggle"),
      metadataInputs: {
        name: document.getElementById("metadata-name"),
        altName: document.getElementById("metadata-alt-name"),
        shortDescription: document.getElementById("metadata-short-description"),
        description: document.getElementById("metadata-description"),
        reference: document.getElementById("metadata-reference"),
        fullReference: document.getElementById("metadata-full-reference"),
      },
      sizeInput: document.getElementById("size"),
      stlSplitEnabledInput: document.getElementById("stl-split-enabled"),
      stlSplitPlaneFields: document.getElementById("stl-split-fields"),
      stlSplitPlaneInputs: {
        h: document.getElementById("stl-split-h"),
        k: document.getElementById("stl-split-k"),
        i: document.getElementById("stl-split-i"),
        l: document.getElementById("stl-split-l"),
      },
      stlSplitPlaneIField: document.getElementById("stl-split-i-field"),
      axisInputs: {
        a: document.createElement("input"),
        b: document.createElement("input"),
        c: document.createElement("input"),
      },
      angleInputs: {
        alpha: document.createElement("input"),
        beta: document.createElement("input"),
        gamma: document.createElement("input"),
      },
      twinTypeSelect: document.getElementById("twin-type"),
      twinRuleInputs: {
        h: document.createElement("input"),
        k: document.createElement("input"),
        i: document.createElement("input"),
        l: document.createElement("input"),
      },
      fromCrystalSelect: document.getElementById("from-crystal"),
      baseFaceRefSelect: document.getElementById("base-face"),
      derivedFaceRefSelect: document.getElementById("derived-face"),
      contactReferenceAxisSelect: document.getElementById("contact-axis"),
      rotationAngleInput: document.getElementById("rotation"),
      axisOffsetInput: document.getElementById("axis-offset"),
      facesTableHeadRow: document.getElementById("head-row"),
      twinSettingsCard: document.getElementById("twin-settings-card"),
      twinSettingsNote: document.getElementById("twin-settings-note"),
      twinSettingsFields: document.getElementById("twin-settings-fields"),
      twinRuleHeading: document.getElementById("twin-rule-heading"),
      twinRuleFields: document.getElementById("twin-rule-fields"),
      twinRuleIField: document.getElementById("twin-rule-i-field"),
      twinAxisAngleField: document.getElementById("twin-axis-angle-field"),
      twinContactFields: document.getElementById("twin-contact-fields"),
      baseFaceRefLabel: document.getElementById("base-face-ref-label"),
      derivedFaceRefLabel: document.getElementById("derived-face-ref-label"),
      faceCrystalTabsContainer: document.getElementById("face-crystal-tabs"),
      faceTabsWrap: document.getElementById("face-tabs-wrap"),
      faceTableWrap: document.getElementById("face-table-wrap"),
      crystalVisibilityToggles: document.getElementById("crystal-visibility"),
      faceDisplayModeSelect: document.getElementById("face-display-mode"),
      toggleFaceLabelsInput: document.getElementById("toggle-face-labels"),
      toggleAxisLabelsInput: document.getElementById("toggle-axis-labels"),
      toggleAxisLinesInnerInput: document.getElementById(
        "toggle-axis-lines-inner",
      ),
      toggleAxisLinesOuterInput: document.getElementById(
        "toggle-axis-lines-outer",
      ),
      toggleTwinRuleInput: document.getElementById("toggle-twin-rule"),
      toggleRidgeLinesInput: document.getElementById("toggle-ridge-lines"),
      toggleIntersectionRidgeLinesInput: document.getElementById(
        "toggle-intersection-ridge-lines",
      ),
      togglePresetMetadataInput: document.getElementById(
        "toggle-preset-metadata",
      ),
      toggleSplitPlaneInput: document.getElementById("toggle-split-plane"),
      toggleInertiaInput: document.getElementById("toggle-inertia"),
    } as unknown;
  }

  function createContext() {
    const parameters = createDefaultTwinParameters();
    const elements = mountElements();
    const state = {
      parameters,
      stlSplit: createDefaultTwinStlSplitSettings(parameters.crystalSystem),
      presetQuery: "",
      presetPopupOpen: false,
      activeFaceCrystalIndex: 0,
      faceDisplayMode: "solid",
      showFaceLabels: false,
      showAxisLabels: false,
      showAxisLinesInner: false,
      showAxisLinesOuter: false,
      showTwinRuleGuide: false,
      showSplitPlaneGuide: false,
      showRidgeLines: false,
      showIntersectionRidgeLines: false,
      showPresetMetadata: false,
      useInertia: false,
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
      faceSort: null,
    };

    return {
      state,
      elements,
      formatCrystalTabLabel: (index: number) => `結晶${index + 1}`,
      formatCrystalUiLabel: (index: number) => `結晶${index + 1}`,
      buildFaceIndexText: (face: { h: number; k: number; l: number }) =>
        `${face.h},${face.k},${face.l}`,
      getActiveCrystalIndex: () => state.activeFaceCrystalIndex,
      getActiveCrystal: (next = state.parameters) => next.twin.crystals[0],
      getEditableCrystalIndex: () => state.activeFaceCrystalIndex,
      closeTabMenuPopover: vi.fn(),
      applyPresetMetadataSectionVisibility: vi.fn(),
      updatePresetMetadataOverlay: vi.fn(),
      renderAxisViewButtons: vi.fn(),
      renderFaceRows: vi.fn(),
      setCrystalVisibilityDefaults: vi.fn(),
      syncPreview: vi.fn(),
      syncFaceSectionCardHeight: vi.fn(),
      resetPreviewViewToFit: vi.fn(),
      isCrystalVisible: vi.fn(() => true),
    };
  }

  it("renderCrystalSystemOptions と preset lookup 系は候補を返し、不一致でも安全に落ちる", () => {
    const context = createContext();
    const actions = createPageUiActions(context);

    actions.renderCrystalSystemOptions();
    expect(
      (context.elements.crystalSystemSelect as HTMLSelectElement).options
        .length,
    ).toBeGreaterThan(0);

    const cubeLabel = actions.getPresetLabelById("cube-00001");
    expect(cubeLabel).toBeTruthy();
    expect(actions.getPresetLabelById("missing")).toBe("");
    expect(actions.findPresetFromQuery(cubeLabel.slice(0, 2))).not.toBeNull();
    expect(actions.findPresetFromQuery("zzzz")).toBeNull();
  });

  it("sync/open/close/applyCustomPresetSelection は preset UI 状態を同期する", () => {
    const context = createContext();
    const actions = createPageUiActions(context);

    context.state.presetQuery = "Corundum";
    context.state.presetPopupOpen = true;
    actions.syncPresetInputUi();
    expect(context.elements.presetOptionsPopup.hidden).toBe(false);

    actions.closePresetPopup();
    expect(context.state.presetPopupOpen).toBe(false);

    actions.openPresetPopup();
    expect(context.state.presetPopupOpen).toBe(true);

    actions.applyCustomPresetSelection("Custom");
    expect(context.state.parameters.presetId).toBe("custom");
    expect(context.state.presetQuery).toBe("Custom");
  });

  it("renderFormValues は STL 分割が有効な時だけ指数入力欄を表示する", () => {
    const context = createContext();
    const actions = createPageUiActions(context);
    const fields = context.elements.stlSplitPlaneFields as HTMLElement;

    actions.renderFormValues();

    expect(fields.hidden).toBe(true);
    expect(fields.style.display).toBe("none");

    context.state.stlSplit.enabled = true;
    actions.renderFormValues();

    expect(fields.hidden).toBe(false);
    expect(fields.style.display).toBe("");
  });

  it("applyTwinPreset は単結晶 preset 適用時に既存の双晶状態を引き継がない", () => {
    const context = createContext();
    const actions = createPageUiActions(context);
    const preset = {
      id: "text-preset",
      parameters: {
        version: 2,
        schema: "sekiei-document",
        crystalSystem: "cubic",
        axes: { a: 1, b: 1, c: 1 },
        angles: { alpha: 90, beta: 90, gamma: 90 },
        sizeMm: 50,
        crystals: [
          {
            id: "base",
            enabled: true,
            faces: [
              {
                id: "face-1",
                h: 1,
                k: 0,
                l: 0,
                coefficient: 1,
                text: {
                  content: "A",
                  fontId: "helvetiker",
                  fontSize: 5,
                  depth: 1,
                  offsetU: 0,
                  offsetV: 0,
                  rotationDeg: 0,
                },
              },
            ],
          },
        ],
      },
    };

    const baseCrystal = structuredClone(
      context.state.parameters.twin.crystals[0],
    );
    context.state.stlSplit = {
      enabled: true,
      plane: { h: 3, k: 2, l: 1 },
    };
    context.state.parameters.twin.enabled = true;
    context.state.parameters.twin.crystals.push({
      ...structuredClone(baseCrystal),
      id: "derived-1",
      from: 0,
    });
    context.state.parameters.twin.crystals.push({
      ...structuredClone(baseCrystal),
      id: "derived-2",
      from: 1,
    });

    actions.applyTwinPreset(preset);

    expect(context.state.parameters.twin.enabled).toBe(false);
    expect(context.state.parameters.twin.crystals).toHaveLength(1);
    expect(context.state.parameters.presetId).toBe("text-preset");
    expect(context.state.activeFaceCrystalIndex).toBe(0);
    expect(context.state.pendingPreviewRefit).toBe(true);
    expect(context.syncPreview).toHaveBeenCalled();
    expect(context.state.stlSplit).toEqual({
      enabled: true,
      plane: { h: 3, k: 2, l: 1 },
    });
    expect(
      context.state.parameters.twin.crystals[0]?.faces.some(
        (face) => String(face.text?.content ?? "") === "A",
      ),
    ).toBe(true);
  });

  it("applyTwinPreset は wrapper preset の preview 設定を現状では適用しない", () => {
    const context = createContext();
    const actions = createPageUiActions(context);
    const preset = {
      id: "wrapper-preset",
      parameters: {
        version: 2,
        schema: "sekiei-document",
        crystalSystem: "cubic",
        axes: { a: 1, b: 1, c: 1 },
        angles: { alpha: 90, beta: 90, gamma: 90 },
        sizeMm: 50,
        crystals: [
          {
            id: "base",
            enabled: true,
            faces: [{ h: 1, k: 0, l: 0, coefficient: 1 }],
          },
        ],
      },
      preview: {
        faceDisplayMode: "xray-solid",
        previewStyleSettings: {
          ridgeLines: { color: "#334455", width: 4, opacity: 0.8 },
        },
      },
    };

    actions.applyTwinPreset(preset);

    expect(context.state.faceDisplayMode).toBe("solid");
    expect(context.state.previewStyleSettings.ridgeLines.color).toBe("#181818");
    expect(context.state.previewStyleSettings.ridgeLines.width).toBe(2);
  });
});
