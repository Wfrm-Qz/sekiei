import { describe, expect, it, vi } from "vitest";
import {
  filterPresetOptions,
  findPresetOptionFromQuery,
  getPresetOptionLabel,
  renderPresetOptionsPopup,
  syncPresetComboboxUi,
} from "../../../../src/ui/preset/presetCombobox.ts";

/**
 * ui/presetCombobox の候補絞り込みと popup 描画を確認する unit test。
 */
describe("ui/presetCombobox", () => {
  const options = [
    { id: "corundum-00001", label: "Corundum" },
    { id: "cube-00001", label: "Cube" },
    { id: "custom", label: "Custom" },
  ];

  it("filterPresetOptions は空 query で全件を返し、前方一致だけを残す", () => {
    expect(filterPresetOptions(options, "")).toHaveLength(3);
    expect(filterPresetOptions(options, "Cu")).toEqual([
      { id: "cube-00001", label: "Cube" },
      { id: "custom", label: "Custom" },
    ]);
    expect(filterPresetOptions(options, "zzz")).toEqual([]);
  });

  it("getPresetOptionLabel と findPresetOptionFromQuery は一致候補を返し、不一致では安全に落ちる", () => {
    expect(getPresetOptionLabel(options, "cube-00001")).toBe("Cube");
    expect(getPresetOptionLabel(options, "missing")).toBe("");

    expect(findPresetOptionFromQuery(options, "Cube")?.id).toBe("cube-00001");
    expect(findPresetOptionFromQuery(options, "Cu")?.id).toBe("cube-00001");
    expect(findPresetOptionFromQuery(options, "")).toBeNull();
    expect(findPresetOptionFromQuery(options, "zzz")).toBeNull();
  });

  it("syncPresetComboboxUi は開閉状態と aria を同期し、open 時だけ render callback を呼ぶ", () => {
    const input = document.createElement("input");
    const clearButton = document.createElement("button");
    const toggleButton = document.createElement("button");
    const popup = document.createElement("div");
    const renderOptions = vi.fn();

    syncPresetComboboxUi(
      { input, clearButton, toggleButton, popup },
      "Corundum",
      true,
      renderOptions,
    );

    expect(input.value).toBe("Corundum");
    expect(clearButton.hidden).toBe(false);
    expect(popup.hidden).toBe(false);
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(renderOptions).toHaveBeenCalledTimes(1);

    syncPresetComboboxUi(
      { input, clearButton, toggleButton, popup },
      "",
      false,
      renderOptions,
    );
    expect(clearButton.hidden).toBe(true);
    expect(popup.hidden).toBe(true);
    expect(renderOptions).toHaveBeenCalledTimes(1);
  });

  it("renderPresetOptionsPopup は候補 button と空状態を描画する", () => {
    const popup = document.createElement("div");
    const onSelect = vi.fn();

    renderPresetOptionsPopup({
      popup,
      options,
      noMatchesText: "no matches",
      onSelect,
    });

    const button = popup.querySelector("button") as HTMLButtonElement;
    expect(button).toHaveTextContent("Corundum");
    button.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onSelect).toHaveBeenCalledWith("corundum-00001");

    renderPresetOptionsPopup({
      popup,
      options: [],
      noMatchesText: "no matches",
      onSelect,
    });
    expect(popup).toHaveTextContent("no matches");
  });
});
