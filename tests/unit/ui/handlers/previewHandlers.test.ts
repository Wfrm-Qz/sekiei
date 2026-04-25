import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../../src/preview/previewStyleSettings.ts";
import { createDefaultTwinStlSplitSettings } from "../../../../src/state/stlSplitSettings.ts";

const { readTwinParametersContentMock } = vi.hoisted(() => ({
  readTwinParametersContentMock: vi.fn(),
}));

vi.mock("../../../../src/domain/parameters.ts", () => ({
  readTwinParametersContent: readTwinParametersContentMock,
}));

import { createTwinPreviewHandlers } from "../../../../src/ui/handlers/previewHandlers.ts";

/**
 * ui/previewHandlers の preview toggle / import 配線を確認する unit test。
 */
describe("ui/previewHandlers", () => {
  beforeEach(() => {
    readTwinParametersContentMock.mockReset();
  });

  function createContext() {
    document.body.innerHTML = `
      <input id="inertia" type="checkbox" />
      <div id="axis-buttons"><button data-axis-label="a"></button></div>
      <input id="axis-inner" type="checkbox" />
      <input id="axis-outer" type="checkbox" />
      <input id="face-labels" type="checkbox" />
      <div id="crystal-toggles"><input data-crystal-index="0" type="checkbox" checked /></div>
      <input id="axis-labels" type="checkbox" />
      <input id="rule" type="checkbox" />
      <input id="metadata" type="checkbox" />
      <input id="split-plane" type="checkbox" />
      <input id="ridge" type="checkbox" />
      <input id="intersection" type="checkbox" />
      <select id="face-display"><option value="solid">solid</option><option value="xray-grouped">xray-grouped</option><option value="custom">custom</option></select>
      <div id="preview-style-panel">
        <button type="button" data-preview-style-reset-scope="basic">reset basic</button>
        <button type="button" data-preview-style-reset-scope="advanced">reset advanced</button>
        <input data-preview-style-key="faceLabel.color" type="color" value="#112233" />
        <input data-preview-style-key="faceLabel.offset" data-preview-style-value-type="number" type="number" value="0.05" />
        <input data-preview-style-key="axisLabel.colors.a" type="color" value="#334455" />
        <input data-preview-style-key="ridgeLines.width" data-preview-style-value-type="number" type="number" value="3" />
        <input data-preview-style-key="customLineProfile.useLayeredLines" type="checkbox" checked />
        <input data-preview-style-key="customLineProfile.hiddenSurfaceLineCustomColor" type="color" value="#445566" />
      </div>
      <button id="download-debug"></button>
      <button id="reset"></button>
      <input id="import" type="file" />
    `;

    const state = {
      parameters: { twin: { crystals: [{ id: "base" }] } },
      stlSplit: createDefaultTwinStlSplitSettings("cubic"),
      activeFaceCrystalIndex: 0,
      useInertia: false,
      previewInertiaActive: true,
      showAxisLinesInner: false,
      showAxisLinesOuter: false,
      showFaceLabels: false,
      crystalVisibility: {},
      showAxisLabels: false,
      showTwinRuleGuide: false,
      showSplitPlaneGuide: false,
      showPresetMetadata: false,
      showRidgeLines: false,
      showIntersectionRidgeLines: false,
      faceDisplayMode: "solid",
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
    };

    return {
      state,
      elements: {
        toggleInertiaInput: document.getElementById(
          "inertia",
        ) as HTMLInputElement,
        axisViewButtons: document.getElementById("axis-buttons") as HTMLElement,
        toggleAxisLinesInnerInput: document.getElementById(
          "axis-inner",
        ) as HTMLInputElement,
        toggleAxisLinesOuterInput: document.getElementById(
          "axis-outer",
        ) as HTMLInputElement,
        toggleFaceLabelsInput: document.getElementById(
          "face-labels",
        ) as HTMLInputElement,
        crystalVisibilityToggles: document.getElementById(
          "crystal-toggles",
        ) as HTMLElement,
        toggleAxisLabelsInput: document.getElementById(
          "axis-labels",
        ) as HTMLInputElement,
        toggleTwinRuleInput: document.getElementById(
          "rule",
        ) as HTMLInputElement,
        togglePresetMetadataInput: document.getElementById(
          "metadata",
        ) as HTMLInputElement,
        toggleSplitPlaneInput: document.getElementById(
          "split-plane",
        ) as HTMLInputElement,
        toggleRidgeLinesInput: document.getElementById(
          "ridge",
        ) as HTMLInputElement,
        toggleIntersectionRidgeLinesInput: document.getElementById(
          "intersection",
        ) as HTMLInputElement,
        faceDisplayModeSelect: document.getElementById(
          "face-display",
        ) as HTMLSelectElement,
        previewStylePanel: document.getElementById(
          "preview-style-panel",
        ) as HTMLElement,
        downloadPreviewDebugButton: document.getElementById(
          "download-debug",
        ) as HTMLButtonElement,
        resetPreviewButton: document.getElementById(
          "reset",
        ) as HTMLButtonElement,
        importJsonInput: document.getElementById("import") as HTMLInputElement,
      },
      controls: { staticMoving: true },
      orientPreviewToAxis: vi.fn(),
      applyAxisGuideVisibility: vi.fn(),
      applyLabelLayerVisibility: vi.fn(),
      requestPreviewOverlayUpdate: vi.fn(),
      setPreview: vi.fn(),
      isCrystalVisible: vi.fn(() => true),
      applyPreviewHelperVisibility: vi.fn(),
      updatePresetMetadataOverlay: vi.fn(),
      resetPreviewViewToFit: vi.fn(),
      downloadPreviewDebugSnapshot: vi.fn(),
      renderFormValues: vi.fn(),
      syncPreview: vi.fn(),
      alert: vi.fn(),
      t: vi.fn((key, params) => `${key}:${params?.message ?? ""}`),
    };
  }

  it("registerPreviewToggleHandlers は toggle ごとの state 更新と callback を配線する", () => {
    const context = createContext();
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewToggleHandlers();

    context.elements.toggleInertiaInput.checked = true;
    context.elements.toggleInertiaInput.dispatchEvent(new Event("change"));
    expect(context.state.useInertia).toBe(true);
    expect(context.controls.staticMoving).toBe(false);
    expect(context.state.previewInertiaActive).toBe(false);

    (
      context.elements.axisViewButtons.querySelector(
        "button",
      ) as HTMLButtonElement
    ).click();
    expect(context.orientPreviewToAxis).toHaveBeenCalledWith("a");

    context.elements.toggleFaceLabelsInput.checked = true;
    context.elements.toggleFaceLabelsInput.dispatchEvent(new Event("change"));
    expect(context.state.showFaceLabels).toBe(true);
    expect(context.applyLabelLayerVisibility).toHaveBeenCalled();
    expect(context.requestPreviewOverlayUpdate).toHaveBeenCalled();

    const crystalToggle =
      context.elements.crystalVisibilityToggles.querySelector(
        "input",
      ) as HTMLInputElement;
    crystalToggle.checked = false;
    crystalToggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(context.state.crystalVisibility.base).toBe(false);
    expect(context.setPreview).toHaveBeenCalled();

    context.elements.toggleSplitPlaneInput.checked = true;
    context.elements.toggleSplitPlaneInput.dispatchEvent(new Event("change"));
    expect(context.state.showSplitPlaneGuide).toBe(true);
    expect(context.applyPreviewHelperVisibility).toHaveBeenCalled();

    const styleColorInput = context.elements.previewStylePanel?.querySelector(
      '[data-preview-style-key="faceLabel.color"]',
    ) as HTMLInputElement;
    styleColorInput.value = "#abcdef";
    styleColorInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(context.state.previewStyleSettings.faceLabel.color).toBe("#abcdef");
    expect(context.updatePresetMetadataOverlay).toHaveBeenCalled();

    const faceLabelOffsetInput =
      context.elements.previewStylePanel?.querySelector(
        '[data-preview-style-key="faceLabel.offset"]',
      ) as HTMLInputElement;
    faceLabelOffsetInput.value = "0.8";
    faceLabelOffsetInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(context.state.previewStyleSettings.faceLabel.offset).toBe(0.8);

    const axisLabelColorInput =
      context.elements.previewStylePanel?.querySelector(
        '[data-preview-style-key="axisLabel.colors.a"]',
      ) as HTMLInputElement;
    axisLabelColorInput.value = "#123456";
    axisLabelColorInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(context.state.previewStyleSettings.axisLabel.colors?.a).toBe(
      "#123456",
    );

    const customLayeredInput =
      context.elements.previewStylePanel?.querySelector(
        '[data-preview-style-key="customLineProfile.useLayeredLines"]',
      ) as HTMLInputElement;
    customLayeredInput.checked = false;
    customLayeredInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(
      context.state.previewStyleSettings.customLineProfile.useLayeredLines,
    ).toBe(false);
    expect(context.state.faceDisplayMode).toBe("custom");
    expect(context.elements.faceDisplayModeSelect.value).toBe("custom");

    const customSurfaceStyleSelect = document.createElement("select");
    customSurfaceStyleSelect.dataset.previewStyleKey =
      "customFaceProfile.surfaceStyle";
    customSurfaceStyleSelect.innerHTML = `
      <option value="grouped">grouped</option>
      <option value="xray-solid">xray-solid</option>
    `;
    context.elements.previewStylePanel?.append(customSurfaceStyleSelect);
    customSurfaceStyleSelect.value = "xray-solid";
    customSurfaceStyleSelect.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
    expect(
      context.state.previewStyleSettings.customFaceProfile.surfaceStyle,
    ).toBe("xray-solid");
    expect(
      context.state.previewStyleSettings.customFaceProfile
        .usesScreenSpaceFaceOverlay,
    ).toBe(false);
    expect(
      context.state.previewStyleSettings.customLineProfile
        .useScreenSpaceLineOverlay,
    ).toBe(false);

    const hiddenSurfaceCustomColorInput =
      context.elements.previewStylePanel?.querySelector(
        '[data-preview-style-key="customLineProfile.hiddenSurfaceLineCustomColor"]',
      ) as HTMLInputElement;
    hiddenSurfaceCustomColorInput.value = "#654321";
    hiddenSurfaceCustomColorInput.dispatchEvent(
      new Event("input", { bubbles: true }),
    );
    expect(
      context.state.previewStyleSettings.customLineProfile
        .hiddenSurfaceLineCustomColor,
    ).toBe("#654321");
    expect(
      context.state.previewStyleSettings.customLineProfile
        .hiddenSurfaceLineColorMode,
    ).toBe("custom");

    context.elements.downloadPreviewDebugButton?.click();
    expect(context.downloadPreviewDebugSnapshot).toHaveBeenCalled();
  });

  it("preview 詳細設定のデフォルトに戻すは高度な設定以外だけを既定値へ戻す", () => {
    const context = createContext();
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewToggleHandlers();

    context.state.previewStyleSettings.faceLabel.color = "#abcdef";
    context.state.previewStyleSettings.faceLabel.offset = 0.8;
    context.state.previewStyleSettings.ridgeLines.width = 7;
    context.state.previewStyleSettings.customFaceProfile.usesLighting = false;
    context.state.previewStyleSettings.customLineProfile.useLayeredLines = false;

    (
      context.elements.previewStylePanel?.querySelector(
        '[data-preview-style-reset-scope="basic"]',
      ) as HTMLButtonElement
    ).click();

    const defaults = createDefaultTwinPreviewStyleSettings();
    expect(context.state.previewStyleSettings.faceLabel.color).toBe(
      defaults.faceLabel.color,
    );
    expect(context.state.previewStyleSettings.faceLabel.offset).toBe(
      defaults.faceLabel.offset,
    );
    expect(context.state.previewStyleSettings.ridgeLines.width).toBe(
      defaults.ridgeLines.width,
    );
    expect(
      context.state.previewStyleSettings.customFaceProfile.usesLighting,
    ).toBe(false);
    expect(
      context.state.previewStyleSettings.customLineProfile.useLayeredLines,
    ).toBe(false);
    expect(context.renderFormValues).toHaveBeenCalled();
  });

  it("高度な設定のデフォルトに戻すは高度な設定だけを既定値へ戻す", () => {
    const context = createContext();
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewToggleHandlers();

    context.state.previewStyleSettings.faceLabel.color = "#abcdef";
    context.state.previewStyleSettings.ridgeLines.width = 7;
    context.state.previewStyleSettings.customFaceProfile.usesLighting = false;
    context.state.previewStyleSettings.customLineProfile.useLayeredLines = false;

    (
      context.elements.previewStylePanel?.querySelector(
        '[data-preview-style-reset-scope="advanced"]',
      ) as HTMLButtonElement
    ).click();

    const defaults = createDefaultTwinPreviewStyleSettings();
    expect(context.state.previewStyleSettings.faceLabel.color).toBe("#abcdef");
    expect(context.state.previewStyleSettings.ridgeLines.width).toBe(7);
    expect(context.state.previewStyleSettings.customFaceProfile).toEqual(
      defaults.customFaceProfile,
    );
    expect(context.state.previewStyleSettings.customLineProfile).toEqual(
      defaults.customLineProfile,
    );
    expect(context.renderFormValues).toHaveBeenCalled();
  });

  it("registerPreviewImportHandlers は成功時に state を同期し、失敗時は alert する", async () => {
    const successContext = createContext();
    const successHandlers = createTwinPreviewHandlers(successContext);
    successHandlers.registerPreviewImportHandlers();

    readTwinParametersContentMock.mockReturnValueOnce({
      twin: { crystals: [{ id: "imported" }] },
    });
    Object.defineProperty(successContext.elements.importJsonInput, "files", {
      value: [
        new File(
          [JSON.stringify({ twin: { crystals: [{ id: "imported" }] } })],
          "preset.json",
          { type: "application/json" },
        ),
      ],
      configurable: true,
    });
    successContext.elements.importJsonInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(successContext.state.parameters).toEqual({
      twin: { crystals: [{ id: "imported" }] },
    });
    expect(successContext.state.pendingPreviewRefit).toBe(true);
    expect(successContext.renderFormValues).toHaveBeenCalled();
    expect(successContext.syncPreview).toHaveBeenCalled();
    expect(successContext.resetPreviewViewToFit).not.toHaveBeenCalled();
    expect(successContext.elements.importJsonInput.value).toBe("");

    const failureContext = createContext();
    const failureHandlers = createTwinPreviewHandlers(failureContext);
    failureHandlers.registerPreviewImportHandlers();
    readTwinParametersContentMock.mockImplementationOnce(() => {
      throw new Error("bad file");
    });
    Object.defineProperty(failureContext.elements.importJsonInput, "files", {
      value: [new File(["{}"], "bad.json", { type: "application/json" })],
      configurable: true,
    });
    failureContext.elements.importJsonInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(failureContext.alert).toHaveBeenCalledWith(
      "common.jsonLoadFailed:bad file",
    );
  });

  it("preview-only import は preview settings だけを読み込み、結晶データは維持する", async () => {
    const context = createContext();
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewImportHandlers();

    context.elements.importJsonInput.dataset.importMode = "preview-only";
    Object.defineProperty(context.elements.importJsonInput, "files", {
      value: [
        new File(
          [
            JSON.stringify({
              schema: "sekiei-twin-preview-document-v1",
              parameters: { twin: { crystals: [{ id: "ignored" }] } },
              preview: {
                faceDisplayMode: "custom",
                previewStyleSettings: {
                  ridgeLines: { color: "#334455", width: 4, opacity: 0.75 },
                },
              },
            }),
          ],
          "preview.json",
          { type: "application/json" },
        ),
      ],
      configurable: true,
    });

    context.elements.importJsonInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(context.state.parameters).toEqual({
      twin: { crystals: [{ id: "base" }] },
    });
    expect(context.state.faceDisplayMode).toBe("custom");
    expect(context.state.previewStyleSettings.ridgeLines.color).toBe("#334455");
    expect(context.state.previewStyleSettings.ridgeLines.width).toBe(4);
    expect(context.syncPreview).not.toHaveBeenCalled();
    expect(context.setPreview).toHaveBeenCalled();
  });

  it("import UI はサイズ上限を超える JSON を text 読込前に拒否する", async () => {
    const context = createContext();
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewImportHandlers();

    const hugeFile = new File(["{}"], "huge.json", {
      type: "application/json",
    });
    Object.defineProperty(hugeFile, "size", {
      value: 1_000_001,
      configurable: true,
    });
    const textSpy = vi.spyOn(hugeFile, "text");

    Object.defineProperty(context.elements.importJsonInput, "files", {
      value: [hugeFile],
      configurable: true,
    });

    context.elements.importJsonInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(textSpy).not.toHaveBeenCalled();
    expect(context.alert).toHaveBeenCalledWith(
      expect.stringContaining("JSON ファイルが大きすぎます。"),
    );
  });

  it("全て import は parameters.crystals 側の accentColor をそのまま読込元へ渡す", async () => {
    const context = createContext();
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewImportHandlers();

    readTwinParametersContentMock.mockImplementationOnce((content: string) =>
      JSON.parse(content),
    );
    Object.defineProperty(context.elements.importJsonInput, "files", {
      value: [
        new File(
          [
            JSON.stringify({
              schema: "sekiei-twin-preview-document-v1",
              parameters: {
                twin: {
                  crystals: [
                    {
                      id: "base",
                      accentColor: "#2255aa",
                      faces: [
                        {
                          id: "f1",
                          h: 1,
                          k: 0,
                          l: 0,
                          coefficient: 1,
                          accentColor: "#3366cc",
                        },
                      ],
                    },
                  ],
                },
              },
              preview: {
                faceDisplayMode: "solid",
                previewStyleSettings: {},
              },
            }),
          ],
          "preview-with-colors.json",
          { type: "application/json" },
        ),
      ],
      configurable: true,
    });

    context.elements.importJsonInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(readTwinParametersContentMock).toHaveBeenCalledWith(
      expect.stringContaining('"accentColor":"#2255aa"'),
    );
    expect(readTwinParametersContentMock).toHaveBeenCalledWith(
      expect.stringContaining('"accentColor":"#3366cc"'),
    );
    expect(context.state.parameters).toEqual({
      twin: {
        crystals: [
          {
            id: "base",
            accentColor: "#2255aa",
            faces: [
              {
                id: "f1",
                h: 1,
                k: 0,
                l: 0,
                coefficient: 1,
                accentColor: "#3366cc",
              },
            ],
          },
        ],
      },
    });
  });

  it("通常 import でも stlSplit 設定は現在値を維持する", async () => {
    const context = createContext();
    context.state.stlSplit = {
      enabled: true,
      plane: { h: 3, k: 2, l: 1 },
    };
    const handlers = createTwinPreviewHandlers(context);
    handlers.registerPreviewImportHandlers();

    readTwinParametersContentMock.mockReturnValueOnce({
      twin: { crystals: [{ id: "imported" }] },
      stlSplit: { enabled: false, plane: { h: 1, k: 1, l: 1 } },
    });

    Object.defineProperty(context.elements.importJsonInput, "files", {
      value: [
        new File(["{}"], "keep-split.json", { type: "application/json" }),
      ],
      configurable: true,
    });

    context.elements.importJsonInput.dispatchEvent(new Event("change"));
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(context.state.stlSplit).toEqual({
      enabled: true,
      plane: { h: 3, k: 2, l: 1 },
    });
  });
});
