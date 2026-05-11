import { describe, expect, it, vi } from "vitest";
import { createTwinFaceTableHandlers } from "../../../../src/ui/faceTable/faceTableHandlers.ts";
import { FACE_TEXT_DEFAULTS } from "../../../../src/constants.ts";

/**
 * ui/faceTableHandlers の面一覧 head/body 配線を確認する unit test。
 */
describe("ui/faceTableHandlers", () => {
  function createContext() {
    document.body.innerHTML = `
      <div id="mobile-toolbar"></div>
      <table>
        <thead><tr id="head"></tr></thead>
        <tbody id="body"></tbody>
      </table>
      <div id="mobile-list"></div>
    `;

    const state = {
      parameters: {
        crystalSystem: "cubic",
        twin: { crystals: [{ contact: {} }] },
      },
      collapsedFaceGroups: {},
      faceTextEditorsExpanded: {},
      faceSort: null,
    };
    const faces = [
      {
        id: "face-1",
        h: 1,
        k: 0,
        l: 0,
        distance: 1,
        enabled: true,
        accentColor: null,
        text: {
          content: "",
          fontId: FACE_TEXT_DEFAULTS.fontId,
          fontSize: FACE_TEXT_DEFAULTS.fontSize,
          depth: FACE_TEXT_DEFAULTS.depth,
          offsetU: FACE_TEXT_DEFAULTS.offsetU,
          offsetV: FACE_TEXT_DEFAULTS.offsetV,
          rotationDeg: FACE_TEXT_DEFAULTS.rotationDeg,
        },
      },
      {
        id: "face-2",
        h: -1,
        k: 0,
        l: 0,
        distance: 1,
        enabled: true,
        accentColor: null,
        text: {
          content: "OTHER",
          fontId: FACE_TEXT_DEFAULTS.fontId,
          fontSize: FACE_TEXT_DEFAULTS.fontSize,
          depth: FACE_TEXT_DEFAULTS.depth,
          offsetU: FACE_TEXT_DEFAULTS.offsetU,
          offsetV: FACE_TEXT_DEFAULTS.offsetV,
          rotationDeg: FACE_TEXT_DEFAULTS.rotationDeg,
        },
      },
    ];

    return {
      context: {
        state,
        elements: {
          facesTableHeadRow: document.getElementById("head") as HTMLElement,
          facesTableBody: document.getElementById("body") as HTMLElement,
          faceMobileToolbar: document.getElementById(
            "mobile-toolbar",
          ) as HTMLElement,
          faceMobileList: document.getElementById("mobile-list") as HTMLElement,
        },
        emptyDraftFaceFields: ["h", "k", "l", "distance"],
        commitParameters: vi.fn((mutator) => mutator(state.parameters)),
        commitNumericInput: vi.fn((rawValue, onCommit) =>
          onCommit(Number(rawValue)),
        ),
        getEditableCrystalIndex: vi.fn(() => 0),
        getEditableFaces: vi.fn(() => faces),
        getTwinCrystalFaces: vi.fn(() => faces),
        setTwinCrystalFaces: vi.fn(),
        createEmptyDraftFace: vi.fn(() => ({
          id: "draft-1",
          h: 0,
          k: 0,
          l: 0,
          distance: 100,
          enabled: false,
          draftEmptyFields: ["h", "k", "l", "distance"],
        })),
        normalizeFaceForSystem: vi.fn((face) => face),
        getEquivalentFaceGroupKey: vi.fn(() => "group-1"),
        getDraftEmptyFields: vi.fn((face) => face?.draftEmptyFields ?? []),
        getNextDistanceValue: vi.fn((value, direction) => value + direction),
        getFaceGroupStateKey: vi.fn((key) => `0::${key}`),
        renderFaceTableHeader: vi.fn(),
        renderFaceRows: vi.fn(),
        confirm: vi.fn(() => true),
        t: vi.fn(() => "confirm"),
      },
      faces,
    };
  }

  it("registerFaceTableHeaderHandlers は add / clear / sort を配線する", () => {
    const { context } = createContext();
    const handlers = createTwinFaceTableHandlers(context);
    handlers.registerFaceTableHeaderHandlers();

    context.elements.facesTableHeadRow.innerHTML = `
      <button id="app-add-face-button"></button>
      <button id="app-clear-faces-button"></button>
      <button data-sort-field="distance" data-sort-direction="asc"></button>
    `;

    (
      context.elements.facesTableHeadRow.querySelector(
        "#app-add-face-button",
      ) as HTMLButtonElement
    ).click();
    expect(context.createEmptyDraftFace).toHaveBeenCalled();
    expect(context.setTwinCrystalFaces).toHaveBeenCalled();

    (
      context.elements.facesTableHeadRow.querySelector(
        "#app-clear-faces-button",
      ) as HTMLButtonElement
    ).click();
    expect(context.confirm).toHaveBeenCalled();

    (
      context.elements.facesTableHeadRow.querySelector(
        '[data-sort-field="distance"]',
      ) as HTMLButtonElement
    ).click();
    expect(context.state.faceSort).toEqual({
      field: "distance",
      direction: "asc",
    });
    expect(context.renderFaceTableHeader).toHaveBeenCalled();
    expect(context.renderFaceRows).toHaveBeenCalled();

    context.elements.faceMobileToolbar!.innerHTML = `
      <button data-mobile-face-action="add"></button>
      <button data-mobile-face-action="clear"></button>
    `;

    (
      context.elements.faceMobileToolbar!.querySelector(
        '[data-mobile-face-action="add"]',
      ) as HTMLButtonElement
    ).click();
    (
      context.elements.faceMobileToolbar!.querySelector(
        '[data-mobile-face-action="clear"]',
      ) as HTMLButtonElement
    ).click();
    expect(context.createEmptyDraftFace).toHaveBeenCalled();
    expect(context.confirm).toHaveBeenCalled();
  });

  it("registerFaceTableInputHandlers / ClickHandlers は enabled, text, spin, group toggle, text toggle を反映する", () => {
    const { context } = createContext();
    const handlers = createTwinFaceTableHandlers(context);
    handlers.registerFaceTableInputHandlers();
    handlers.registerFaceTableClickHandlers();

    context.elements.facesTableBody.innerHTML = `
      <tr data-face-index="0" data-face-id="face-1" data-group-key="group-1" data-group-collapsed="false">
        <td><input data-face-field="enabled" type="checkbox" /></td>
        <td><input data-face-field="accentColor" type="color" value="#3366cc" /></td>
        <td>
          <input data-face-field="h" value="1" />
          <button class="face-index-spin-button" data-face-index-field="h" data-spin-direction="down"></button>
        </td>
        <td>
          <input data-face-field="distance" value="1" />
          <button class="distance-spin-button" data-spin-direction="up"></button>
        </td>
        <td><button class="face-group-toggle" data-group-key="group-1"></button></td>
      </tr>
      <tr data-face-index="0" data-face-id="face-1" data-group-key="group-1" data-group-collapsed="false">
        <td>
          <input data-face-text-field="content" value="R" />
          <input data-face-text-field="fontSize" value="" />
        </td>
      </tr>
      <tr data-face-index="0" data-face-id="face-1" data-group-key="group-1" data-group-collapsed="false">
        <td><button class="toggle-face-text-button" data-face-text-toggle="true"></button></td>
      </tr>
    `;

    const enabledInput = context.elements.facesTableBody.querySelector(
      '[data-face-field="enabled"]',
    ) as HTMLInputElement;
    enabledInput.checked = false;
    enabledInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(context.commitParameters).toHaveBeenCalled();

    const accentColorInput = context.elements.facesTableBody.querySelector(
      '[data-face-field="accentColor"]',
    ) as HTMLInputElement;
    accentColorInput.value = "#3366cc";
    accentColorInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(context.setTwinCrystalFaces).toHaveBeenCalledWith(
      context.state.parameters,
      0,
      expect.arrayContaining([
        expect.objectContaining({
          id: "face-1",
          accentColor: "#3366cc",
        }),
      ]),
    );

    const textContentInput = context.elements.facesTableBody.querySelector(
      '[data-face-text-field="content"]',
    ) as HTMLInputElement;
    textContentInput.value = "NEW";
    textContentInput.dispatchEvent(new Event("input", { bubbles: true }));
    expect(context.commitParameters).toHaveBeenCalled();
    expect(context.setTwinCrystalFaces).toHaveBeenCalledWith(
      context.state.parameters,
      0,
      expect.arrayContaining([
        expect.objectContaining({
          id: "face-1",
          text: expect.objectContaining({ content: "NEW" }),
        }),
        expect.objectContaining({
          id: "face-2",
          text: expect.objectContaining({ content: "OTHER" }),
        }),
      ]),
    );

    const textSizeInput = context.elements.facesTableBody.querySelector(
      '[data-face-text-field="fontSize"]',
    ) as HTMLInputElement;
    textSizeInput.dispatchEvent(new Event("change", { bubbles: true }));
    expect(context.commitParameters).toHaveBeenCalled();

    const indexSpinButton = context.elements.facesTableBody.querySelector(
      ".face-index-spin-button",
    ) as HTMLButtonElement;
    const indexMouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    indexSpinButton.dispatchEvent(indexMouseDownEvent);
    expect(indexMouseDownEvent.defaultPrevented).toBe(true);
    indexSpinButton.click();
    expect(
      (
        context.elements.facesTableBody.querySelector(
          '[data-face-field="h"]',
        ) as HTMLInputElement
      ).value,
    ).toBe("0");
    expect(context.commitNumericInput).toHaveBeenCalledWith(
      "0",
      expect.any(Function),
    );

    const spinButton = context.elements.facesTableBody.querySelector(
      ".distance-spin-button",
    ) as HTMLButtonElement;
    const mouseDownEvent = new MouseEvent("mousedown", {
      bubbles: true,
      cancelable: true,
    });
    spinButton.dispatchEvent(mouseDownEvent);
    expect(mouseDownEvent.defaultPrevented).toBe(true);
    spinButton.click();
    expect(context.getNextDistanceValue).toHaveBeenCalledWith(1, 1);

    const toggleButton = context.elements.facesTableBody.querySelector(
      ".face-group-toggle",
    ) as HTMLButtonElement;
    toggleButton.click();
    expect(context.state.collapsedFaceGroups["0::group-1"]).toBe(true);
    expect(context.renderFaceRows).toHaveBeenCalled();

    const textToggleButton = context.elements.facesTableBody.querySelector(
      ".toggle-face-text-button",
    ) as HTMLButtonElement;
    textToggleButton.click();
    expect(context.state.faceTextEditorsExpanded["face-1"]).toBe(true);
    expect(context.renderFaceRows).toHaveBeenCalledTimes(2);
  });

  it("折り畳み代表行の accentColor 変更は等価面グループ全体へ適用する", () => {
    const { context } = createContext();
    const handlers = createTwinFaceTableHandlers(context);
    handlers.registerFaceTableInputHandlers();

    context.elements.facesTableBody.innerHTML = `
      <tr data-face-index="0" data-face-id="face-1" data-group-key="group-1" data-group-collapsed="true">
        <td><input data-face-field="accentColor" type="color" value="#ff6600" /></td>
      </tr>
    `;

    const accentColorInput = context.elements.facesTableBody.querySelector(
      '[data-face-field="accentColor"]',
    ) as HTMLInputElement;
    accentColorInput.value = "#ff6600";
    accentColorInput.dispatchEvent(new Event("change", { bubbles: true }));

    expect(context.setTwinCrystalFaces).toHaveBeenCalledWith(
      context.state.parameters,
      0,
      expect.arrayContaining([
        expect.objectContaining({ id: "face-1", accentColor: "#ff6600" }),
        expect.objectContaining({ id: "face-2", accentColor: "#ff6600" }),
      ]),
    );
  });

  it("mobile list 側の click/input でも同じ face handlers を使える", () => {
    const { context } = createContext();
    const handlers = createTwinFaceTableHandlers(context);
    handlers.registerFaceTableInputHandlers();
    handlers.registerFaceTableClickHandlers();

    context.elements.faceMobileList!.innerHTML = `
      <article data-face-index="0" data-face-id="face-1" data-group-key="group-1" data-group-collapsed="false">
        <input data-face-field="enabled" type="checkbox" />
        <input data-face-field="accentColor" type="color" value="#2244aa" />
        <input data-face-field="distance" value="1" />
        <button class="distance-spin-button" data-spin-direction="down"></button>
        <button class="toggle-face-text-button" data-face-text-toggle="true"></button>
        <input data-face-text-field="content" value="R" />
      </article>
    `;

    const enabledInput = context.elements.faceMobileList!.querySelector(
      '[data-face-field="enabled"]',
    ) as HTMLInputElement;
    enabledInput.checked = false;
    enabledInput.dispatchEvent(new Event("change", { bubbles: true }));

    const textContentInput = context.elements.faceMobileList!.querySelector(
      '[data-face-text-field="content"]',
    ) as HTMLInputElement;
    textContentInput.value = "MOBILE";
    textContentInput.dispatchEvent(new Event("input", { bubbles: true }));

    (
      context.elements.faceMobileList!.querySelector(
        ".distance-spin-button",
      ) as HTMLButtonElement
    ).click();
    (
      context.elements.faceMobileList!.querySelector(
        ".toggle-face-text-button",
      ) as HTMLButtonElement
    ).click();

    expect(context.commitParameters).toHaveBeenCalled();
    expect(context.getNextDistanceValue).toHaveBeenCalledWith(1, -1);
    expect(context.state.faceTextEditorsExpanded["face-1"]).toBe(true);
  });
});
