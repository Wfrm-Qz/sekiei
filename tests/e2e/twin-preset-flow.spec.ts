import { expect, test } from "@playwright/test";

/**
 * 双晶ページの最重要ジャーニーを確認する E2E。
 *
 * プリセット適用後に双晶設定 UI へ値が反映されることを押さえ、
 * Vite 移行・ローカライズ・preset 周りの退行をまとめて監視する。
 */
test("日本式双晶プリセットを適用すると metadata と結晶系が反映される", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("sekiei.locale", "ja");
  });
  await page.goto("/");

  const presetInput = page.getByPlaceholder("プリセット選択");
  await expect(presetInput).toBeVisible();
  await expect(presetInput).toHaveValue(/立方体|Cube/);

  await presetInput.fill("日本式双晶");
  await presetInput.press("Enter");

  await expect(page.getByRole("textbox", { name: /^名前$/ })).toHaveValue(
    "日本式双晶",
  );
  await expect(page.locator("#app-crystal-system-select")).toHaveValue(
    "trigonal",
  );
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(
    page.getByRole("menuitem", { name: "JSON" }).first(),
  ).toBeVisible();
});
