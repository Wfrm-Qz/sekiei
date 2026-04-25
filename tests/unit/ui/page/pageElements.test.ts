import { describe, expect, it } from "vitest";
import { queryAppPageElements } from "../../../../src/ui/page/pageElements.ts";

/**
 * pageElements の DOM query 一覧が主要 id を拾えることを確認する unit test。
 */
describe("ui/pageElements", () => {
  it("正常系では存在する主要要素を拾い、欠損要素は null のまま返す", () => {
    document.body.innerHTML = `
      <label id="app-locale-label"></label>
      <select id="app-locale-select"></select>
      <div id="app-announcement-modal"></div>
      <time id="app-announcement-updated-at-value"></time>
      <div id="app-announcement-history"></div>
      <ul id="app-announcement-known-issues"></ul>
      <a id="app-announcement-feedback-github-link"></a>
      <a id="app-announcement-feedback-author-x-link"></a>
      <a id="app-announcement-github-link"></a>
      <a id="app-announcement-author-x-link"></a>
      <button id="app-announcement-open-button"></button>
      <button id="app-announcement-dismiss-button"></button>
      <div id="app-preset-combobox"></div>
      <input id="app-size-mm-input" />
      <div class="preview-panel"></div>
      <canvas id="app-preview-canvas"></canvas>
    `;

    const elements = queryAppPageElements();

    expect(elements.localeLabel?.id).toBe("app-locale-label");
    expect(elements.localeSelect?.id).toBe("app-locale-select");
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
    expect(elements.announcementDismissButton?.id).toBe(
      "app-announcement-dismiss-button",
    );
    expect(elements.sizeInput?.id).toBe("app-size-mm-input");
    expect(elements.previewPanel).toHaveClass("preview-panel");
    expect(elements.canvas?.id).toBe("app-preview-canvas");
    expect(elements.saveButton).toBeNull();
  });
});
