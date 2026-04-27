import path from "node:path";
import { expect, test } from "@playwright/test";
import { openSekieiApp } from "./helpers";

const INPUT_JSON_PATH = path.resolve(
  process.cwd(),
  "tests",
  "fixtures",
  "face-text",
  "leftQuartz.withText.v2.json",
);

test("左水晶 import 後の STL 保存でデバッグ JSON を自動保存しない", async ({
  page,
}) => {
  let dialogMessage: string | null = null;
  page.on("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await openSekieiApp(page);

  await page.setInputFiles("#app-import-json-input", INPUT_JSON_PATH);
  await expect(page.getByRole("textbox", { name: /^名前$/ })).toHaveValue(
    "左水晶",
    { timeout: 15_000 },
  );

  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (download) => {
    downloads.push(download);
  });

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator('#app-save-menu [data-export-format="stl"]').click();

  await expect
    .poll(() => downloads.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(1);

  const stlDownload = downloads.find((download) =>
    /\.stl$/i.test(download.suggestedFilename()),
  );
  expect(stlDownload).toBeTruthy();
  await page.waitForTimeout(500);
  const debugDownload = downloads.find((download) =>
    /-stl-debug\.json$/i.test(download.suggestedFilename()),
  );
  expect(debugDownload).toBeUndefined();

  expect(dialogMessage).toBeNull();
});
