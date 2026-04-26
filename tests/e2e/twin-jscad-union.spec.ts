import { expect, test } from "@playwright/test";
import { openSekieiApp, selectPreset } from "./helpers";

/**
 * browser-only の JSCAD union 経路が、日本式双晶プリセット相当の preview 構築で
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

  await openSekieiApp(page);
  await selectPreset(page, "石英", "quartz-00002");

  await expect(page.locator("#app-crystal-system-select")).toHaveValue(
    "trigonal",
  );
  await expect(page.locator("#app-metadata-description-input")).toHaveValue(
    "日本式双晶",
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
