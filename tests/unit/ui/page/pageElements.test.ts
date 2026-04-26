import { describe, expect, it } from "vitest";
import { queryAppPageElements } from "../../../../src/ui/page/pageElements.ts";

/**
 * pageElements の DOM query 一覧が主要 id を拾えることを確認する unit test。
 */
describe("ui/pageElements", () => {
  it("正常系では存在する主要要素を拾い、欠損要素は null のまま返す", () => {
    document.body.innerHTML = `
      <main id="app-main-content"></main>
      <label id="app-locale-label"></label>
      <select id="app-locale-select"></select>
      <div id="app-mobile-layout-tabs"></div>
      <button data-mobile-layout-tab-button="basic"></button>
      <button data-mobile-layout-tab-button="face"></button>
      <div id="app-announcement-modal"></div>
      <time id="app-announcement-updated-at-value"></time>
      <div id="app-announcement-history"></div>
      <ul id="app-announcement-known-issues"></ul>
      <a id="app-announcement-feedback-github-link"></a>
      <a id="app-announcement-feedback-author-x-link"></a>
      <a id="app-announcement-github-link"></a>
      <a id="app-announcement-author-x-link"></a>
      <button id="app-announcement-open-button"></button>
      <button id="app-mobile-header-menu-button"></button>
      <div id="app-mobile-header-menu"></div>
      <button id="app-announcement-dismiss-button"></button>
      <div id="app-preset-combobox"></div>
      <input id="app-size-mm-input" />
      <div id="app-face-mobile-toolbar"></div>
      <div id="app-face-mobile-list"></div>
      <div class="mobile-output-flow">
        <button data-export-format="json" data-save-mode="save"></button>
        <button data-import-mode="both"></button>
      </div>
      <div class="preview-panel"></div>
      <canvas id="app-preview-canvas"></canvas>
    `;

    const elements = queryAppPageElements();

    expect(elements.localeLabel?.id).toBe("app-locale-label");
    expect(elements.localeSelect?.id).toBe("app-locale-select");
    expect(elements.mainContent?.id).toBe("app-main-content");
    expect(elements.mobileLayoutTabs?.id).toBe("app-mobile-layout-tabs");
    expect(elements.mobileLayoutTabButtons).toHaveLength(2);
    expect(elements.announcementModal?.id).toBe("app-announcement-modal");
    expect(elements.announcementUpdatedAtValue?.id).toBe(
      "app-announcement-updated-at-value",
    );
    expect(elements.announcementHistoryList?.id).toBe(
      "app-announcement-history",
    );
    expect(elements.announcementKnownIssuesList?.id).toBe(
      "app-announcement-known-issues",
    );
    expect(elements.announcementFeedbackGithubLink?.id).toBe(
      "app-announcement-feedback-github-link",
    );
    expect(elements.announcementFeedbackAuthorXLink?.id).toBe(
      "app-announcement-feedback-author-x-link",
    );
    expect(elements.announcementOpenButton?.id).toBe(
      "app-announcement-open-button",
    );
    expect(elements.mobileHeaderMenuButton?.id).toBe(
      "app-mobile-header-menu-button",
    );
    expect(elements.mobileHeaderMenu?.id).toBe("app-mobile-header-menu");
    expect(elements.announcementDismissButton?.id).toBe(
      "app-announcement-dismiss-button",
    );
    expect(elements.sizeInput?.id).toBe("app-size-mm-input");
    expect(elements.faceMobileToolbar?.id).toBe("app-face-mobile-toolbar");
    expect(elements.faceMobileList?.id).toBe("app-face-mobile-list");
    expect(elements.mobileOutputExportButtons).toHaveLength(1);
    expect(elements.mobileOutputImportButtons).toHaveLength(1);
    expect(elements.previewPanel).toHaveClass("preview-panel");
    expect(elements.canvas?.id).toBe("app-preview-canvas");
    expect(elements.saveButton).toBeNull();
  });
});
