import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";

const INPUT_JSON_PATH = path.resolve(process.cwd(), "temp", "左水晶 (1).json");

test("左水晶 import 後の STL debug で fallback と composite candidate を比較できる", async ({
  page,
}, testInfo) => {
  let dialogMessage: string | null = null;
  page.on("dialog", async (dialog) => {
    dialogMessage = dialog.message();
    await dialog.dismiss();
  });

  await page.addInitScript(() => {
    localStorage.setItem("sekiei.locale", "ja");
  });
  await page.goto("/");

  await page.setInputFiles("#app-import-json-input", INPUT_JSON_PATH);
  await expect(page.getByRole("textbox", { name: /^名前$/ })).toHaveValue(
    "左水晶",
  );

  const downloads: import("@playwright/test").Download[] = [];
  page.on("download", (download) => {
    downloads.push(download);
  });

  await page.getByRole("button", { name: "保存", exact: true }).click();
  await page.locator('#app-save-menu [data-export-format="stl"]').click();

  await expect
    .poll(() => downloads.length, { timeout: 15_000 })
    .toBeGreaterThanOrEqual(2);

  const debugDownload = downloads.find((download) =>
    /-stl-debug\.json$/i.test(download.suggestedFilename()),
  );
  expect(debugDownload).toBeTruthy();
  if (!debugDownload) {
    throw new Error("STL debug JSON download が見つかりません");
  }

  const debugPath = testInfo.outputPath(debugDownload.suggestedFilename());
  await debugDownload.saveAs(debugPath);
  const debugJson = JSON.parse(await fs.readFile(debugPath, "utf8"));

  const summary = {
    selectedSource: debugJson.selectedSource ?? null,
    preferTextPreservingFallback:
      debugJson.preferTextPreservingFallback ?? null,
    fallbackTopology:
      debugJson.fallbackCandidate?.topologyAfterOrientation ?? null,
    compositeTopology:
      debugJson.compositeCandidate?.topologyAfterOrientation ?? null,
    unionTopology: debugJson.unionCandidate?.topologyAfterOrientation ?? null,
    dialogMessage,
  };
  const summaryPath = testInfo.outputPath("stl-compare-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");

  expect(dialogMessage).toBeNull();
  expect(summary.fallbackTopology).toBeTruthy();
  expect(summary.compositeTopology).toBeTruthy();
  expect(path.basename(summaryPath)).toBe("stl-compare-summary.json");
});
