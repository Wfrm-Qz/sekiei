import { expect, test } from "@playwright/test";

/**
 * browser-only の JSCAD union 経路が、日本式双晶の preview 構築で
 * 実際に落ちないことを固定する smoke test。
 */
test("日本式双晶の preview 構築で JSCAD union 経路が browser 上で落ちない", async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];

  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
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

  const canvas = page.locator("#app-preview-canvas");
  await expect(canvas).toBeVisible();
  const bounds = await canvas.boundingBox();
  expect(bounds?.width ?? 0).toBeGreaterThan(0);
  expect(bounds?.height ?? 0).toBeGreaterThan(0);

  await expect.poll(() => pageErrors, { timeout: 5_000 }).toHaveLength(0);
  await expect
    .poll(
      () =>
        consoleErrors.filter(
          (message) =>
            !message.includes("WebGL") &&
            !message.includes("favicon") &&
            !message.includes("Failed to load resource") &&
            !message.includes("[GroupMarkerNotSet") &&
            !message.includes("frame-ancestors"),
        ),
      { timeout: 5_000 },
    )
    .toHaveLength(0);
});
