import { expect, test } from "@playwright/test";

/**
 * 半透明 SVG export の実行経路を守る smoke test。
 *
 * 以前、半透明時だけ import 漏れの runtime error で SVG export が失敗した。
 * ここでは xray-grouped へ切り替えて実際に SVG を保存し、少なくとも
 * alert で落ちずに SVG download が始まることを固定する。
 */
test("半透明表示でも SVG を保存できる", async ({ page }) => {
  let dialogMessage = null;
  page.on("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await page.addInitScript(() => {
    localStorage.setItem("sekiei.locale", "ja");
  });
  await page.goto("/");

  const presetInput = page.getByPlaceholder("プリセット選択");
  await expect(presetInput).toBeVisible();
  await presetInput.fill("コランダム");
  await presetInput.press("Enter");

  await page
    .locator("#app-face-display-mode-select")
    .selectOption("xray-grouped");

  await page.getByRole("button", { name: "保存", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator('#app-save-menu [data-export-format="svg"]').click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toMatch(/\.svg$/i);
  expect(dialogMessage).toBeNull();
});
