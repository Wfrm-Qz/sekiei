import { beforeEach, describe, expect, it } from "vitest";
import { setCurrentLocale } from "../../../../src/i18n.ts";
import { applyControlHelpAttributes } from "../../../../src/ui/page/controlHelp.ts";
import { setupHelpTooltip } from "../../../../src/ui/page/helpTooltip.ts";

function hover(element: Element) {
  element.dispatchEvent(
    new MouseEvent("pointerover", {
      bubbles: true,
      clientX: 24,
      clientY: 32,
    }),
  );
}

describe("ui/page/helpTooltip", () => {
  beforeEach(() => {
    setCurrentLocale("ja");
    document.body.innerHTML = "";
  });

  it("data-help-key の説明をホバーで表示する", () => {
    document.body.innerHTML = `
      <button type="button" data-help-key="help.face.add">面を追加</button>
    `;
    setupHelpTooltip(document);

    hover(document.querySelector("button") as HTMLButtonElement);

    const tooltip = document.querySelector<HTMLElement>("#app-help-tooltip");
    expect(tooltip?.hidden).toBe(false);
    expect(tooltip).toHaveTextContent("現在の結晶に新しい面を追加します。");
  });

  it("操作不能状態では disabled 用の理由を表示する", () => {
    document.body.innerHTML = `
      <button
        type="button"
        data-help-key="help.face.clearAll"
        data-disabled-help-key="help.disabled.noFaces"
        disabled
      >
        面を全削除
      </button>
    `;
    setupHelpTooltip(document);

    hover(document.querySelector("button") as HTMLButtonElement);

    const tooltip = document.querySelector<HTMLElement>("#app-help-tooltip");
    expect(tooltip?.hidden).toBe(false);
    expect(tooltip).toHaveTextContent("面がないため実行できません。");
  });

  it("既存の入力欄に説明キーと操作不能理由を付与する", () => {
    document.body.innerHTML = `
      <label class="field">
        <span>a</span>
        <input id="twin-axis-a-input" type="number" disabled />
      </label>
      <button id="app-add-face-button" type="button">面を追加</button>
    `;

    applyControlHelpAttributes(document);

    const axisInput =
      document.querySelector<HTMLInputElement>("#twin-axis-a-input");
    const addButton = document.querySelector<HTMLButtonElement>(
      "#app-add-face-button",
    );
    expect(axisInput?.dataset.helpKey).toBe("help.crystal.axisRatio");
    expect(axisInput?.dataset.disabledHelpKey).toBe(
      "help.disabled.crystalSystemLocked",
    );
    expect(addButton?.dataset.helpKey).toBe("help.face.add");
  });

  it("軸正対ボタンは正の軸側から見る説明を表示する", () => {
    document.body.innerHTML = `
      <button
        class="preview-axis-view-button"
        type="button"
        data-axis-label="a"
      >
        a
      </button>
    `;
    applyControlHelpAttributes(document);
    setupHelpTooltip(document);

    hover(document.querySelector("button") as HTMLButtonElement);

    const tooltip = document.querySelector<HTMLElement>("#app-help-tooltip");
    expect(tooltip).toHaveTextContent(
      "正の a 軸側から結晶中心を見る視点に切り替えます。",
    );
  });
});
