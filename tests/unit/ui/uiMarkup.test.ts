import { describe, expect, it } from "vitest";
import {
  buildCrystalTabMarkup,
  buildCrystalVisibilityToggleMarkup,
  replaceSelectOptions,
} from "../../../src/ui/uiMarkup.ts";

/**
 * uiMarkup の小さな HTML 断片 helper を確認する unit test。
 */
describe("ui/uiMarkup", () => {
  it("replaceSelectOptions は正常系で option を差し替える", () => {
    const select = document.createElement("select");
    select.innerHTML = '<option value="old">old</option>';

    replaceSelectOptions(select, [
      { value: "a", label: "A" },
      { value: "b", label: "B" },
    ]);

    expect(select.options).toHaveLength(2);
    expect(select.options[0].value).toBe("a");
    expect(select.options[1].textContent).toBe("B");
  });

  it("buildCrystalTabMarkup は active state と data 属性を含む", () => {
    const markup = buildCrystalTabMarkup({
      index: 2,
      label: "結晶3",
      isActive: true,
      menuAriaLabel: "結晶3 の操作",
      tabBackground: "rgba(0,0,0,0.1)",
      tabHoverBackground: "rgba(0,0,0,0.2)",
      tabActiveBackground: "rgba(0,0,0,0.3)",
      tabBorder: "rgba(0,0,0,0.4)",
    });

    expect(markup).toContain('data-crystal-index="2"');
    expect(markup).toContain('data-crystal-menu-index="2"');
    expect(markup).toContain('aria-selected="true"');
  });

  it("buildCrystalVisibilityToggleMarkup は checked / disabled を反映する", () => {
    const checked = buildCrystalVisibilityToggleMarkup({
      index: 1,
      label: "結晶2",
      checked: true,
      disabled: false,
    });
    const disabled = buildCrystalVisibilityToggleMarkup({
      index: 0,
      label: "結晶1",
      checked: false,
      disabled: true,
    });

    expect(checked).toContain('data-crystal-index="1"');
    expect(checked).toContain("checked");
    expect(disabled).toContain("disabled");
  });
});
