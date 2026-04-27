import { expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function resolveLatestAnnouncementRevision() {
  const source = readFileSync(
    resolve(process.cwd(), "src/content/announcements.ts"),
    "utf8",
  );
  const id = source.match(/\bid:\s*"([^"]+)"/)?.[1];
  const updatedAt = source.match(/\bupdatedAt:\s*"([^"]+)"/)?.[1];
  if (!id || !updatedAt) {
    throw new Error("Could not resolve latest announcement revision for E2E.");
  }
  return `${id}::${updatedAt}`;
}

const ANNOUNCEMENT_REVISION = resolveLatestAnnouncementRevision();

/**
 * E2E では本筋と無関係な起動時お知らせを既読扱いにして、主要フローへすぐ入る。
 */
export async function openSekieiApp(page: Page) {
  await page.addInitScript(
    ({ locale, announcementRevision }) => {
      localStorage.setItem("sekiei.locale", locale);
      localStorage.setItem(
        "sekiei.announcement.lastSeenRevision",
        announcementRevision,
      );
    },
    {
      locale: "ja",
      announcementRevision: ANNOUNCEMENT_REVISION,
    },
  );
  await page.goto("/");
  await expect(page.locator("#app-metadata-name-input")).toHaveValue(
    /立方体|Cube/,
    { timeout: 15_000 },
  );
}

/**
 * combobox popup の option を実際に選んで、現在の preset 適用フローに沿わせる。
 */
export async function selectPreset(
  page: Page,
  presetQuery: string,
  presetId: string,
) {
  const presetInput = page.getByPlaceholder("プリセット選択");
  await expect(presetInput).toBeVisible();
  await presetInput.fill(presetQuery);
  const option = page.locator(`[role="option"][data-preset-id="${presetId}"]`);
  await expect(option).toBeVisible();
  await option.click();
}
