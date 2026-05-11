import { describe, expect, it, vi } from "vitest";
import { createTwinCrystalConfigHandlers } from "../../../../src/ui/handlers/crystalConfigHandlers.ts";
import { createDefaultTwinStlSplitSettings } from "../../../../src/state/stlSplitSettings.ts";

/**
 * ui/crystalConfigHandlers の結晶設定 / 結晶タブ操作を確認する unit test。
 */
describe("ui/crystalConfigHandlers", () => {
  function createParameters() {
    return {
      crystalSystem: "cubic",
      sizeMm: 50,
      axes: { a: 1, b: 1, c: 1 },
      angles: { alpha: 90, beta: 90, gamma: 90 },
      faces: [
        { id: "face-1", h: 1, k: 0, l: 0, coefficient: 1, enabled: true },
      ],
      twin: {
        crystals: [
          {
            id: "base",
            faces: [
              { id: "face-1", h: 1, k: 0, l: 0, coefficient: 1, enabled: true },
            ],
            twinType: "penetration",
            ruleType: "axis",
            plane: { h: 1, k: 1, l: 1 },
            axis: { h: 1, k: 1, l: 1 },
            rotationAngleDeg: 60,
            from: 0,
            contact: {},
          },
          {
            id: "derived",
            faces: [
              { id: "face-2", h: 0, k: 1, l: 0, coefficient: 1, enabled: true },
            ],
            twinType: "penetration",
            ruleType: "axis",
            plane: { h: 1, k: 1, l: 1 },
            axis: { h: 1, k: 1, l: 1 },
            rotationAngleDeg: 60,
            from: 0,
            contact: {},
          },
        ],
      },
    };
  }

  function createContext() {
    document.body.innerHTML = `
      <select id="system"><option value="cubic">cubic</option><option value="hexagonal">hexagonal</option></select>
      <input id="size" />
      <input id="split-enabled" type="checkbox" />
      <input id="split-h" />
      <input id="split-k" />
      <input id="split-i" />
      <input id="split-l" />
      <input id="axis-a" />
      <input id="axis-b" />
      <input id="axis-c" />
      <input id="angle-alpha" />
      <input id="angle-beta" />
      <input id="angle-gamma" />
      <select id="twin-type"><option value="penetration">penetration</option><option value="contact">contact</option></select>
      <input id="rule-h" />
      <input id="rule-k" />
      <input id="rule-l" />
      <input id="rotation" />
      <input id="axis-offset" />
      <select id="from"><option value="0">0</option></select>
      <select id="base-face"><option value="face-1">face-1</option></select>
      <select id="derived-face"><option value="face-2">face-2</option></select>
      <select id="axis-ref"><option value="">auto</option><option value="c">c</option></select>
      <div id="tabs">
        <button id="app-add-crystal-tab"></button>
      </div>
      <div id="popover">
        <button class="crystal-tab-menu-action" data-crystal-index="1" data-tab-action="duplicate"></button>
        <div data-crystal-color-panel-index="1">
          <input type="color" data-crystal-color-index="1" value="#112233" />
        </div>
        <button class="crystal-tab-menu-action" data-crystal-index="1" data-tab-action="delete"></button>
      </div>
    `;

    const state = {
      parameters: createParameters(),
      stlSplit: createDefaultTwinStlSplitSettings("cubic"),
      activeFaceCrystalIndex: 1,
    };

    return {
      state,
      elements: {
        crystalSystemSelect: document.getElementById(
          "system",
        ) as HTMLSelectElement,
        sizeInput: document.getElementById("size") as HTMLInputElement,
        stlSplitEnabledInput: document.getElementById(
          "split-enabled",
        ) as HTMLInputElement,
        stlSplitPlaneInputs: {
          h: document.getElementById("split-h") as HTMLInputElement,
          k: document.getElementById("split-k") as HTMLInputElement,
          i: document.getElementById("split-i") as HTMLInputElement,
          l: document.getElementById("split-l") as HTMLInputElement,
        },
        axisInputs: {
          a: document.getElementById("axis-a") as HTMLInputElement,
          b: document.getElementById("axis-b") as HTMLInputElement,
          c: document.getElementById("axis-c") as HTMLInputElement,
        },
        angleInputs: {
          alpha: document.getElementById("angle-alpha") as HTMLInputElement,
          beta: document.getElementById("angle-beta") as HTMLInputElement,
          gamma: document.getElementById("angle-gamma") as HTMLInputElement,
        },
        twinTypeSelect: document.getElementById(
          "twin-type",
        ) as HTMLSelectElement,
        twinRuleInputs: {
          h: document.getElementById("rule-h") as HTMLInputElement,
          k: document.getElementById("rule-k") as HTMLInputElement,
          l: document.getElementById("rule-l") as HTMLInputElement,
        },
        rotationAngleInput: document.getElementById(
          "rotation",
        ) as HTMLInputElement,
        axisOffsetInput: document.getElementById(
          "axis-offset",
        ) as HTMLInputElement,
        fromCrystalSelect: document.getElementById("from") as HTMLSelectElement,
        baseFaceRefSelect: document.getElementById(
          "base-face",
        ) as HTMLSelectElement,
        derivedFaceRefSelect: document.getElementById(
          "derived-face",
        ) as HTMLSelectElement,
        contactReferenceAxisSelect: document.getElementById(
          "axis-ref",
        ) as HTMLSelectElement,
        faceCrystalTabsContainer: document.getElementById(
          "tabs",
        ) as HTMLElement,
        tabMenuPopover: document.getElementById("popover") as HTMLElement,
      },
      commitNumericInput: vi.fn((rawValue, onCommit) =>
        onCommit(Number(rawValue)),
      ),
      commitParameters: vi.fn((mutator) => mutator(state.parameters)),
      commitStlSplit: vi.fn((mutator) => mutator(state.stlSplit)),
      getActiveCrystalIndex: vi.fn(() => state.activeFaceCrystalIndex),
      renderFormValues: vi.fn(),
      syncPreview: vi.fn(),
      updateCrystalAccentColor: vi.fn(),
      appendDerivedCrystal: vi.fn((next, sourceIndex, sourceFaces) => {
        next.twin.crystals.push({
          id: `derived-${next.twin.crystals.length}`,
          faces: sourceFaces,
          twinType: "penetration",
          ruleType: "axis",
          plane: { h: 1, k: 1, l: 1 },
          axis: { h: 1, k: 1, l: 1 },
          rotationAngleDeg: 60,
          from: sourceIndex,
          contact: {},
        });
      }),
      deleteCrystalAtIndex: vi.fn(),
      toggleTabMenuPopover: vi.fn(),
      closeTabMenuPopover: vi.fn(),
      closeHeaderSaveMenus: vi.fn(),
    };
  }

  it("registerCrystalConfigHandlers は数値入力と twin 設定変更を反映する", () => {
    const context = createContext();
    const handlers = createTwinCrystalConfigHandlers(context);
    handlers.registerCrystalConfigHandlers();

    context.elements.sizeInput.value = "75";
    context.elements.sizeInput.dispatchEvent(new Event("change"));
    expect(context.state.parameters.sizeMm).toBe(75);

    context.elements.stlSplitEnabledInput.checked = true;
    context.elements.stlSplitEnabledInput.dispatchEvent(new Event("change"));
    expect(context.state.stlSplit.enabled).toBe(true);

    context.elements.stlSplitPlaneInputs.h.value = "2";
    context.elements.stlSplitPlaneInputs.h.dispatchEvent(new Event("change"));
    expect(context.state.stlSplit.plane.h).toBe(2);

    context.elements.axisOffsetInput.value = "0.5";
    context.elements.axisOffsetInput.dispatchEvent(new Event("change"));
    expect(context.state.parameters.twin.crystals[1].offsets).toEqual([
      {
        kind: "axis",
        basis: "twin-axis",
        amount: 0.5,
        unit: "axis-plane-intercept",
      },
    ]);

    context.elements.twinTypeSelect.value = "contact";
    context.elements.twinTypeSelect.dispatchEvent(new Event("change"));
    expect(context.state.parameters.twin.crystals[1].twinType).toBe("contact");
    expect(context.state.parameters.twin.crystals[1].ruleType).toBe("plane");

    context.elements.contactReferenceAxisSelect.value = "c";
    context.elements.contactReferenceAxisSelect.dispatchEvent(
      new Event("change"),
    );
    expect(
      context.state.parameters.twin.crystals[1].contact.referenceAxisLabel,
    ).toBe("c");
  });

  it("registerCrystalTabHandlers は結晶追加 / 複製 / 色変更 / 削除を配線する", () => {
    const context = createContext();
    const handlers = createTwinCrystalConfigHandlers(context);
    handlers.registerCrystalTabHandlers();

    (
      document.getElementById("app-add-crystal-tab") as HTMLButtonElement
    ).click();
    expect(context.appendDerivedCrystal).toHaveBeenCalled();
    expect(context.renderFormValues).toHaveBeenCalled();
    expect(context.syncPreview).toHaveBeenCalled();

    const duplicateButton = context.elements.tabMenuPopover.querySelector(
      '[data-tab-action="duplicate"]',
    ) as HTMLButtonElement;
    duplicateButton.click();
    expect(context.appendDerivedCrystal).toHaveBeenCalledTimes(2);
    context.closeTabMenuPopover.mockClear();

    const colorInput = context.elements.tabMenuPopover.querySelector(
      'input[type="color"][data-crystal-color-index="1"]',
    ) as HTMLInputElement;
    colorInput.value = "#445566";
    colorInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(context.updateCrystalAccentColor).toHaveBeenCalledWith(1, "#445566");
    expect(context.closeTabMenuPopover).not.toHaveBeenCalled();

    const deleteButton = context.elements.tabMenuPopover.querySelector(
      '[data-tab-action="delete"]',
    ) as HTMLButtonElement;
    deleteButton.click();
    expect(context.deleteCrystalAtIndex).toHaveBeenCalledWith(1);
  });
});
