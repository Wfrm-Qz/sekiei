import { expect, test } from "@playwright/test";
import { openSekieiApp, selectPreset } from "./helpers";

/**
 * 双晶ページの最重要ジャーニーを確認する E2E。
 *
 * プリセット適用後に日本式双晶プリセット相当の値が UI へ反映されることを押さえ、
 * Vite 移行・ローカライズ・preset 周りの退行をまとめて監視する。
 */
test("日本式双晶プリセットを適用すると metadata と結晶系が反映される", async ({
  page,
}) => {
  await openSekieiApp(page);
  await expect(page.getByPlaceholder("プリセット選択")).toHaveValue(
    /立方体|Cube/,
  );
  await selectPreset(page, "石英", "quartz-00002");

  await expect(page.getByRole("textbox", { name: /^名前$/ })).toHaveValue(
    "石英",
  );
  await expect(page.locator("#app-metadata-description-input")).toHaveValue(
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
