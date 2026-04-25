import { describe, expect, it } from "vitest";
import { applySettingsPanelViewModel } from "../../../src/ui/settingsPanel.ts";

/**
 * ui/settingsPanel の表示切り替え反映を確認する unit test。
 */
describe("ui/settingsPanel", () => {
  function createElements() {
    document.body.innerHTML = `
      <section id="card"></section>
      <p id="note"></p>
      <div id="fields"></div>
      <h3 id="rule-heading"></h3>
      <div id="rule-fields"></div>
      <div id="rule-i-field"></div>
      <div id="axis-angle-field"></div>
      <div id="contact-fields"></div>
      <label id="base-face-ref-label"></label>
      <label id="derived-face-ref-label"></label>
    `;

    return {
      card: document.querySelector("#card") as HTMLElement,
      note: document.querySelector("#note") as HTMLElement,
      fields: document.querySelector("#fields") as HTMLElement,
      ruleHeading: document.querySelector("#rule-heading") as HTMLElement,
      ruleFields: document.querySelector("#rule-fields") as HTMLElement,
      ruleIField: document.querySelector("#rule-i-field") as HTMLElement,
      axisAngleField: document.querySelector(
        "#axis-angle-field",
      ) as HTMLElement,
      contactFields: document.querySelector("#contact-fields") as HTMLElement,
      baseFaceRefLabel: document.querySelector(
        "#base-face-ref-label",
      ) as HTMLElement,
      derivedFaceRefLabel: document.querySelector(
        "#derived-face-ref-label",
      ) as HTMLElement,
    };
  }

  it("正常系では view model に従って表示文言と hidden/display を更新する", () => {
    const elements = createElements();

    applySettingsPanelViewModel(elements, {
      noteText: "派生結晶の双晶則を設定します。",
      ruleHeadingText: "双晶面指数",
      baseFaceRefLabelText: "基準面",
      derivedFaceRefLabelText: "派生面",
      showFields: true,
      showRuleInputs: true,
      showFourAxisRuleIndex: false,
      showContactFields: true,
    });

    expect(elements.card.hidden).toBe(false);
    expect(elements.note).toHaveTextContent("派生結晶の双晶則を設定します。");
    expect(elements.ruleHeading).toHaveTextContent("双晶面指数");
    expect(elements.baseFaceRefLabel).toHaveTextContent("基準面");
    expect(elements.derivedFaceRefLabel).toHaveTextContent("派生面");
    expect(elements.fields.hidden).toBe(false);
    expect(elements.ruleFields.hidden).toBe(false);
    expect(elements.ruleIField.hidden).toBe(true);
    expect(elements.contactFields.hidden).toBe(false);
    expect(elements.ruleIField.style.display).toBe("none");
  });

  it("異常系寄りの非表示指定では対象要素を hidden/display:none にする", () => {
    const elements = createElements();

    applySettingsPanelViewModel(elements, {
      noteText: "",
      ruleHeadingText: "",
      baseFaceRefLabelText: "",
      derivedFaceRefLabelText: "",
      showFields: false,
      showRuleInputs: false,
      showFourAxisRuleIndex: false,
      showContactFields: false,
    });

    expect(elements.fields.hidden).toBe(true);
    expect(elements.ruleHeading.hidden).toBe(true);
    expect(elements.ruleFields.hidden).toBe(true);
    expect(elements.axisAngleField.hidden).toBe(true);
    expect(elements.contactFields.hidden).toBe(true);
    expect(elements.fields.style.display).toBe("none");
    expect(elements.contactFields.style.display).toBe("none");
  });
});
