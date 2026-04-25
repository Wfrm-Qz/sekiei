import { screen } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  renderPresetOptionsPopup,
  syncPresetComboboxUi,
} from "../../../../src/ui/preset/presetCombobox.ts";

/**
 * プリセット検索コンボボックスの DOM 挙動を確認する integration test。
 *
 * entry file 全体は大きいので、ここでは popup 描画と ARIA 同期を
 * 実際の DOM 上で検証する。
 */
describe("ui/presetCombobox", () => {
  it("popup を開いたときに候補を描画し、選択 callback を呼ぶ", async () => {
    document.body.innerHTML = `
      <div>
        <input id="preset-input" />
        <button id="preset-clear" type="button" hidden>clear</button>
        <button id="preset-toggle" type="button"></button>
        <div id="preset-popup" role="listbox" hidden></div>
      </div>
    `;
    const onSelect = vi.fn();
    const user = userEvent.setup();
    const popup = document.getElementById("preset-popup") as HTMLElement;
    const input = document.getElementById("preset-input") as HTMLInputElement;
    const clearButton = document.getElementById("preset-clear") as HTMLElement;
    const toggleButton = document.getElementById(
      "preset-toggle",
    ) as HTMLElement;

    syncPresetComboboxUi(
      {
        input,
        clearButton,
        toggleButton,
        popup,
      },
      "立方",
      true,
      () =>
        renderPresetOptionsPopup({
          popup,
          options: [{ id: "cube-00001", label: "立方体" }],
          noMatchesText: "一致なし",
          onSelect,
        }),
    );

    expect(input).toHaveValue("立方");
    expect(input).toHaveAttribute("aria-expanded", "true");
    expect(toggleButton).toHaveAttribute("aria-expanded", "true");
    expect(clearButton).not.toHaveAttribute("hidden");
    expect(popup).not.toHaveAttribute("hidden");

    await user.click(screen.getByRole("option", { name: "立方体" }));

    expect(onSelect).toHaveBeenCalledWith("cube-00001");
  });

  it("候補がないときは no-match 文言を表示し、option を出さない", () => {
    document.body.innerHTML = `<div id="preset-popup" role="listbox"></div>`;
    const popup = document.getElementById("preset-popup") as HTMLElement;

    renderPresetOptionsPopup({
      popup,
      options: [],
      noMatchesText: "一致なし",
      onSelect: vi.fn(),
    });

    expect(screen.getByText("一致なし")).toBeTruthy();
    expect(screen.queryByRole("option")).toBeNull();
  });
});
