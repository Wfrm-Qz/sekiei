import { describe, expect, it } from "vitest";
import {
  closeHeaderActionMenus,
  findHeaderActionMenuItem,
  toggleHeaderActionMenu,
} from "../../../src/ui/headerActionMenu.ts";

/**
 * headerActionMenu のメニュー開閉 helper を確認する unit test。
 */
describe("ui/headerActionMenu", () => {
  function createBinding() {
    const button = document.createElement("button");
    const menu = document.createElement("div");
    menu.hidden = true;
    return { button, menu };
  }

  it("closeHeaderActionMenus は正常系で全メニューを閉じる", () => {
    const left = createBinding();
    const right = createBinding();
    left.menu.hidden = false;
    right.menu.hidden = false;

    closeHeaderActionMenus([left, right]);

    expect(left.menu.hidden).toBe(true);
    expect(right.menu.hidden).toBe(true);
    expect(left.button).toHaveAttribute("aria-expanded", "false");
  });

  it("toggleHeaderActionMenu は対象だけ開閉し、button/menu 欠損では何もしない", () => {
    const left = createBinding();
    const right = createBinding();

    toggleHeaderActionMenu(left, [left, right]);
    expect(left.menu.hidden).toBe(false);
    expect(right.menu.hidden).toBe(true);

    toggleHeaderActionMenu(left, [left, right]);
    expect(left.menu.hidden).toBe(true);

    expect(() =>
      toggleHeaderActionMenu({ button: null, menu: null }, [left, right]),
    ).not.toThrow();
  });

  it("findHeaderActionMenuItem は closest item を返し、非 Element は null を返す", () => {
    document.body.innerHTML =
      '<div class="header-action-menu-item"><span id="inner"></span></div>';

    expect(
      findHeaderActionMenuItem(document.getElementById("inner")),
    ).toHaveClass("header-action-menu-item");
    expect(findHeaderActionMenuItem(null)).toBeNull();
  });
});
