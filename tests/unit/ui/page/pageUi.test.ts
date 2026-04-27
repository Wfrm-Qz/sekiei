import { describe, expect, it, vi } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../../src/preview/previewStyleSettings.ts";
import { createPageUiHelpers } from "../../../../src/ui/page/pageUi.ts";

/**
 * ui/pageUi の小さな DOM 描画 helper を確認する unit test。
 */
describe("ui/pageUi", () => {
  function mountElements() {
    document.body.innerHTML = `
      <div id="axis-buttons"></div>
      <div id="overlay"></div>
      <div id="overlay-name"></div>
      <div id="overlay-short"></div>
      <div id="advanced"></div>
      <button id="toggle"></button>
      <div id="face-table-wrap">
        <table>
          <thead id="faces-table-head"></thead>
          <tbody id="faces-table-body"></tbody>
        </table>
      </div>
      <div id="messages"></div>
    `;
    const wrap = document.querySelector("#face-table-wrap") as HTMLElement;
    Object.defineProperty(wrap, "scrollHeight", {
      value: 400,
      configurable: true,
    });
    Object.defineProperty(wrap, "clientHeight", {
      value: 120,
      configurable: true,
    });
    wrap.scrollTo = vi.fn();
    Object.defineProperty(
      document.querySelector("#faces-table-head") as HTMLElement,
      "offsetHeight",
      {
        value: 32,
        configurable: true,
      },
    );

    return {
      axisViewButtons: document.querySelector("#axis-buttons") as HTMLElement,
      presetMetadataOverlay: document.querySelector("#overlay") as HTMLElement,
      presetMetadataName: document.querySelector(
        "#overlay-name",
      ) as HTMLElement,
      presetMetadataShortDescription: document.querySelector(
        "#overlay-short",
      ) as HTMLElement,
      presetMetadataAdvanced: document.querySelector(
        "#advanced",
      ) as HTMLElement,
      presetMetadataToggleButton: document.querySelector(
        "#toggle",
      ) as HTMLButtonElement,
      faceTableWrap: wrap,
      facesTableBody: document.querySelector(
        "#faces-table-body",
      ) as HTMLElement,
      messagesPanel: document.querySelector("#messages") as HTMLElement,
    };
  }

  function createContext() {
    const elements = mountElements();
    const state = {
      parameters: {
        name: { jp: "日本式双晶", en: "Japan-law twin" },
        shortDescription: "短い説明",
      },
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
      showPresetMetadata: true,
      presetMetadataExpanded: false,
      buildResult: null,
      activeFaceCrystalIndex: 0,
    };

    return {
      state,
      elements,
      getPreviewAxisGuides: () => [{ label: "a" }, { label: "c" }],
      getCurrentLocale: () => "ja",
      t: (key: string, params: Record<string, string> = {}) =>
        key === "validation.validInput"
          ? "入力値は現在の条件では有効です。"
          : key === "preset.metadataToggle.more"
            ? "詳細表示"
            : key === "preset.metadataToggle.less"
              ? "折り畳み"
              : key === "crystals.first"
                ? "結晶1"
                : `translated:${key}:${params.index ?? ""}`,
      getEditableCrystalIndex: () => 0,
      renderFormValues: vi.fn(),
    };
  }

  it("renderAxisViewButtons は正常系で button を作り、異常系寄りの空 guide では何も出さない", () => {
    const context = createContext();
    const helpers = createPageUiHelpers(context);

    helpers.renderAxisViewButtons();
    expect(
      context.elements.axisViewButtons.querySelectorAll("button"),
    ).toHaveLength(2);
    expect(
      context.elements.axisViewButtons.querySelector("button"),
    ).toHaveTextContent("a");
    expect(
      context.elements.axisViewButtons.querySelector("button"),
    ).toHaveAttribute("data-help-key", "help.preview.axisView");
    expect(
      context.elements.axisViewButtons.querySelector("button"),
    ).toHaveAttribute("data-help-label", "a");

    context.getPreviewAxisGuides = () => [];
    helpers.renderAxisViewButtons();
    expect(context.elements.axisViewButtons.childElementCount).toBe(0);
  });

  it("metadata overlay / section visibility は state に従って表示を切り替える", () => {
    const context = createContext();
    const helpers = createPageUiHelpers(context);

    helpers.updatePresetMetadataOverlay();
    expect(context.elements.presetMetadataOverlay.hidden).toBe(false);
    expect(context.elements.presetMetadataName).toHaveTextContent("日本式双晶");

    context.state.showPresetMetadata = false;
    helpers.updatePresetMetadataOverlay();
    expect(context.elements.presetMetadataOverlay.hidden).toBe(true);

    helpers.applyPresetMetadataSectionVisibility();
    expect(context.elements.presetMetadataToggleButton).toHaveTextContent(
      "詳細表示",
    );
    context.state.presetMetadataExpanded = true;
    helpers.applyPresetMetadataSectionVisibility();
    expect(context.elements.presetMetadataToggleButton).toHaveTextContent(
      "折り畳み",
    );
  });

  it("syncFaceListToPreviewFace は対象行へスクロールし、結晶切替が必要なら renderFormValues も呼ぶ", () => {
    const requestAnimationFrameSpy = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback: FrameRequestCallback) => {
        callback(0);
        return 1;
      });

    try {
      const context = createContext();
      context.elements.facesTableBody.innerHTML = `
        <tr data-face-id="face-1"></tr>
        <tr data-group-key="group-2"></tr>
      `;
      Object.defineProperty(
        context.elements.facesTableBody.querySelector(
          '[data-face-id="face-1"]',
        ),
        "offsetTop",
        { value: 80, configurable: true },
      );

      const helpers = createPageUiHelpers(context);
      helpers.syncFaceListToPreviewFace(0, "face-1", null);
      expect(context.elements.faceTableWrap.scrollTo).toHaveBeenCalledWith({
        top: 40,
        behavior: "smooth",
      });

      context.getEditableCrystalIndex = () => 1;
      helpers.syncFaceListToPreviewFace(0, null, "group-2");
      expect(context.state.activeFaceCrystalIndex).toBe(0);
      expect(context.renderFormValues).toHaveBeenCalled();
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  });

  it("buildFaceIndexText は結晶系に応じて 3 index / 4 index を切り替える", () => {
    const helpers = createPageUiHelpers(createContext());

    expect(
      helpers.buildFaceIndexText({ h: 1, k: 2, i: -3, l: 4 }, "hexagonal"),
    ).toBe("1, 2, -3, 4");
    expect(helpers.buildFaceIndexText({ h: 1, k: 2, l: 4 }, "cubic")).toBe(
      "1, 2, 4",
    );
  });

  it("renderMessages は error / warning を描画し、異常系寄りの空状態では info を出す", () => {
    const context = createContext();
    const helpers = createPageUiHelpers(context);

    context.state.buildResult = {
      validation: {
        errors: ["error-1"],
        warnings: ["warning-1"],
      },
    };
    helpers.renderMessages();
    expect(context.elements.messagesPanel.children).toHaveLength(2);
    expect(context.elements.messagesPanel.textContent).toContain("error-1");
    expect(context.elements.messagesPanel.textContent).toContain("warning-1");

    context.state.buildResult = null;
    helpers.renderMessages();
    expect(context.elements.messagesPanel.children).toHaveLength(1);
    expect(context.elements.messagesPanel).toHaveTextContent(
      "入力値は現在の条件では有効です。",
    );
  });

  it("renderStats は no-op として呼び出せる", () => {
    const helpers = createPageUiHelpers(createContext());
    expect(() => helpers.renderStats()).not.toThrow();
  });
});
