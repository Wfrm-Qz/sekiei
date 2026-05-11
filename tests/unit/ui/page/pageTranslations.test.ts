import { describe, expect, it } from "vitest";
import { t } from "../../../../src/i18n.ts";
import { queryAppPageElements } from "../../../../src/ui/page/pageElements.ts";
import { applyPageStaticTranslations } from "../../../../src/ui/page/pageTranslations.ts";

/**
 * pageTranslations の静的ラベル反映を確認する unit test。
 */
describe("ui/pageTranslations", () => {
  function mountPage() {
    document.body.innerHTML = `
      <div class="page-header">
        <h1>
          <span data-i18n="app.headerTitle"></span>
          <span data-i18n="app.headerExpansion"></span>
        </h1>
        <p class="subtitle"></p>
      </div>
      <label><span id="app-locale-label"></span><select id="app-locale-select"></select></label>
      <button id="app-import-json-button"></button>
      <div id="app-import-json-menu">
        <button data-import-mode="both"></button>
        <button data-import-mode="preview-only"></button>
        <button data-import-mode="crystal-only"></button>
      </div>
      <div id="app-preset-combobox"></div>
      <input id="app-preset-select" />
      <button id="app-preset-clear-button"></button>
      <button id="app-preset-toggle-button"></button>
      <div id="app-preset-options-popup"></div>
      <div class="preset-metadata-card"><h2></h2></div>
      <label><span></span><input id="app-metadata-name-input" /></label>
      <label><span></span><input id="app-metadata-short-description-input" /></label>
      <label><span></span><input id="app-metadata-alt-name-input" /></label>
      <label><span></span><textarea id="app-metadata-description-input"></textarea></label>
      <label><span></span><input id="app-metadata-reference-input" /></label>
      <label><span></span><textarea id="app-metadata-full-reference-input"></textarea></label>
      <button id="app-preset-metadata-toggle"></button>
      <div id="app-preset-metadata-advanced"></div>
      <div class="section-card"><div class="section-heading"><h2></h2></div></div>
      <div class="section-card"><div class="section-heading"><h2></h2></div></div>
      <div class="section-card"><div class="section-heading"><h2></h2><p></p></div></div>
      <div class="section-card"><div class="section-heading"><h2></h2></div></div>
      <label><span></span><select id="app-crystal-system-select"></select></label>
      <label><span></span><input id="app-size-mm-input" /></label>
      <div class="editor-subheading"></div>
      <div class="editor-subheading"></div>
      <section id="twin-settings-card"><h2></h2><div class="section-heading"><p></p></div></section>
      <label><span></span><select id="twin-from-crystal-select"></select></label>
      <label><span></span><select id="twin-type-select"><option></option><option></option></select></label>
      <label><span></span><input id="twin-rotation-angle-input" /></label>
      <label><span></span><input id="twin-axis-offset-input" /></label>
      <label><span></span><select id="twin-contact-reference-axis-select"></select></label>
      <button id="app-save-button"></button>
      <button id="app-save-as-button"></button>
      <input id="app-import-json-input" />
      <div id="app-axis-view-buttons"></div>
      <div class="preview-hint"></div>
      <select id="app-face-display-mode-select">
        <option></option><option></option><option></option><option></option><option></option><option></option>
      </select>
      <label><span></span><input id="twin-toggle-face-labels-input" /></label>
      <label><span></span><input id="twin-toggle-ridge-lines-input" /></label>
      <label><span></span><input id="twin-toggle-intersection-ridge-lines-input" /></label>
      <label><span></span><input id="twin-toggle-axis-lines-inner-input" /></label>
      <label><span></span><input id="twin-toggle-axis-lines-outer-input" /></label>
      <label><span></span><input id="twin-toggle-axis-labels-input" /></label>
      <label><span></span><input id="twin-toggle-twin-rule-input" /></label>
      <label><span></span><input id="twin-toggle-preset-metadata-input" /></label>
      <label><span></span><input id="twin-toggle-split-plane-input" /></label>
      <div class="face-section-card"><h2></h2></div>
      <div class="crystal-tab-list" id="face-tabs"></div>
      <label><span></span><input id="twin-toggle-inertia-input" /></label>
      <button id="app-reset-preview-button"></button>
    `;
    return queryAppPageElements();
  }

  it("正常系では日本語ラベルを主要要素へ反映する", () => {
    const elements = mountPage();

    applyPageStaticTranslations(elements, "ja", (key, params) =>
      t(key, params, "ja"),
    );

    expect(document.title).toBe("Sekiei");
    expect(elements.saveButton).toHaveTextContent("保存");
    expect(elements.resetPreviewButton).toHaveTextContent("視点リセット");
    expect(
      document.querySelector(".page-header h1 [data-i18n='app.headerTitle']"),
    ).toHaveTextContent("SEKIEI");
    expect(
      document.querySelector(
        ".page-header h1 [data-i18n='app.headerExpansion']",
      ),
    ).toHaveTextContent(
      "Shape Editor for Kessho Illustration, Export, and Inscription",
    );
    expect(document.querySelector(".page-header .subtitle")).toHaveTextContent(
      "オフラインで結晶の3Dモデルを作成し、STL / SVG / PNG / JPEG形式で出力できます",
    );
  });

  it("英語では反対言語名ラベルを Name (Japanese) へ切り替える", () => {
    const elements = mountPage();

    applyPageStaticTranslations(elements, "en", (key, params) =>
      t(key, params, "en"),
    );

    expect(
      elements.metadataInputs.altName?.closest("label")?.querySelector("span"),
    ).toHaveTextContent("Name (Japanese)");
  });
});
