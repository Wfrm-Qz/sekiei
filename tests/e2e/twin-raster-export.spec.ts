import { expect, test } from "@playwright/test";

/**
 * preview ベースの raster export が、union 実装差し替え後も
 * 少なくとも download 開始まで到達することを固定する smoke test。
 */
for (const format of ["png", "jpeg"] as const) {
  test(`${format.toUpperCase()} を保存できる`, async ({ page }) => {
    let dialogMessage: string | null = null;
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
    await presetInput.fill("日本式双晶");
    await presetInput.press("Enter");

    await expect(page.locator("#app-crystal-system-select")).toHaveValue(
      "trigonal",
    );

    await page.getByRole("button", { name: "保存", exact: true }).click();
    const downloadPromise = page.waitForEvent("download");
    await page
      .locator(`#app-save-menu [data-export-format="${format}"]`)
      .click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(
      format === "png" ? /\.png$/i : /\.jpe?g$/i,
    );
    expect(dialogMessage).toBeNull();
  });
}
