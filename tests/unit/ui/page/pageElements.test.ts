import { describe, expect, it } from "vitest";
import { queryAppPageElements } from "../../../../src/ui/page/pageElements.ts";

/**
 * pageElements の DOM query 一覧が主要 id を拾えることを確認する unit test。
 */
describe("ui/pageElements", () => {
  it("正常系では存在する主要要素を拾い、欠損要素は null のまま返す", () => {
    document.body.innerHTML = `
      <label id="app-locale-label"></label>
      <select id="app-locale-select"></select>
      <div id="app-preset-combobox"></div>
      <input id="app-size-mm-input" />
      <div class="preview-panel"></div>
      <canvas id="app-preview-canvas"></canvas>
    `;

    const elements = queryAppPageElements();

    expect(elements.localeLabel?.id).toBe("app-locale-label");
    expect(elements.localeSelect?.id).toBe("app-locale-select");
    expect(elements.sizeInput?.id).toBe("app-size-mm-input");
    expect(elements.previewPanel).toHaveClass("preview-panel");
    expect(elements.canvas?.id).toBe("app-preview-canvas");
    expect(elements.saveButton).toBeNull();
  });
});
