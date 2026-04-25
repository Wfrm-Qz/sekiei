import { expect, test } from "@playwright/test";

/**
 * 半透明や操作系の refactor 後も、慣性回転終了時に軸ラベルが戻ることを確認する E2E。
 *
 * ラベル層は回転中に一時非表示へするが、停止後に復帰しない退行が起きやすいため、
 * preview 操作を伴う smoke test として固定する。
 */
test("回転の慣性終了後に軸ラベルが再表示される", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("sekiei.locale", "ja");
  });
  await page.goto("/");

  await page.getByLabel("回転の慣性").check();
  const axisLabels = page.locator(".axis-overlay-label");
  await expect(axisLabels).toHaveCount(3);

  const canvas = page.locator("#app-preview-canvas");
  const box = await canvas.boundingBox();
  if (!box) {
    throw new Error("preview canvas bounds are unavailable");
  }

  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.72, box.y + box.height * 0.58, {
    steps: 10,
  });
  await page.mouse.up();

  await page.waitForTimeout(500);
  await expect(axisLabels).toHaveCount(3);
  await expect(axisLabels.first()).toBeVisible();
});
