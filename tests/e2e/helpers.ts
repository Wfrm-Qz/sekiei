import { expect, type Page } from "@playwright/test";

const ANNOUNCEMENT_REVISION =
  "2026-04-26-notice-board::2026-04-27T00:10:00+09:00";

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
