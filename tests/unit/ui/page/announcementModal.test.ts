import { describe, expect, it } from "vitest";
import { getLatestAnnouncement } from "../../../../src/content/announcements.ts";
import {
  getCurrentLocale,
  onLocaleChange,
  setCurrentLocale,
} from "../../../../src/i18n.ts";
import {
  ANNOUNCEMENT_STORAGE_KEY,
  createAnnouncementModalActions,
  shouldShowAnnouncement,
} from "../../../../src/ui/page/announcementModal.ts";
import { queryAppPageElements } from "../../../../src/ui/page/pageElements.ts";

function mountAnnouncementModal() {
  document.body.innerHTML = `
    <div id="app-announcement-modal" hidden>
      <div id="app-announcement-backdrop"></div>
      <section>
        <button id="app-announcement-close-button" type="button">×</button>
        <time id="app-announcement-updated-at-value"></time>
        <div id="app-announcement-history"></div>
        <ul id="app-announcement-known-issues"></ul>
        <a id="app-announcement-feedback-github-link">GitHubのレポジトリ</a>
        <a id="app-announcement-feedback-author-x-link">作者X</a>
        <a id="app-announcement-github-link"><span class="visually-hidden"></span></a>
        <a id="app-announcement-author-x-link"><span class="visually-hidden"></span></a>
        <button id="app-announcement-dismiss-button" type="button">OK</button>
      </section>
    </div>
  `;
  return queryAppPageElements();
}

describe("ui/page/announcementModal", () => {
  it("未読のお知らせがあると起動時に表示し、閉じると既読を保存する", () => {
    const latestAnnouncement = getLatestAnnouncement();
    const elements = mountAnnouncementModal();
    const { initAnnouncementModal } = createAnnouncementModalActions({
      elements,
      getLocale: getCurrentLocale,
      onLocaleChange,
    });

    initAnnouncementModal();

    expect(elements.announcementModal).not.toHaveAttribute("hidden");
    expect(elements.announcementUpdatedAtValue).toHaveTextContent("2026");
    expect(elements.announcementHistoryList?.children).toHaveLength(
      latestAnnouncement?.history.length ?? 0,
    );
    expect(elements.announcementDismissButton).toHaveFocus();

    elements.announcementDismissButton?.click();

    expect(elements.announcementModal).toHaveAttribute("hidden");
    expect(localStorage.getItem(ANNOUNCEMENT_STORAGE_KEY)).toBe(
      latestAnnouncement
        ? `${latestAnnouncement.id}::${latestAnnouncement.updatedAt}`
        : null,
    );
  });

  it("既読のお知らせは自動表示しない", () => {
    const latestAnnouncement = getLatestAnnouncement();
    localStorage.setItem(
      ANNOUNCEMENT_STORAGE_KEY,
      latestAnnouncement
        ? `${latestAnnouncement.id}::${latestAnnouncement.updatedAt}`
        : "missing",
    );
    const elements = mountAnnouncementModal();
    const { initAnnouncementModal } = createAnnouncementModalActions({
      elements,
      getLocale: getCurrentLocale,
      onLocaleChange,
    });

    initAnnouncementModal();

    expect(elements.announcementModal).toHaveAttribute("hidden");
  });

  it("旧形式の id 保存でも未更新なら既読扱いにする", () => {
    const latestAnnouncement = getLatestAnnouncement();
    if (!latestAnnouncement) {
      throw new Error("latest announcement is required for this test");
    }
    const unchangedAnnouncement = {
      ...latestAnnouncement,
      updatedAt:
        latestAnnouncement.history[0]?.date ?? latestAnnouncement.updatedAt,
    };

    localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, unchangedAnnouncement.id);

    expect(shouldShowAnnouncement(unchangedAnnouncement, localStorage)).toBe(
      false,
    );
  });

  it("updatedAt が変わったお知らせは同じ id でも再表示する", () => {
    const latestAnnouncement = getLatestAnnouncement();
    if (!latestAnnouncement) {
      throw new Error("latest announcement is required for this test");
    }

    localStorage.setItem(ANNOUNCEMENT_STORAGE_KEY, latestAnnouncement.id);

    expect(
      shouldShowAnnouncement(
        {
          ...latestAnnouncement,
          updatedAt: "2026-05-01T00:00:00+09:00",
        },
        localStorage,
      ),
    ).toBe(true);
  });

  it("ロケール変更に追従して履歴とリンク表示を差し替える", () => {
    const latestAnnouncement = getLatestAnnouncement();
    const elements = mountAnnouncementModal();
    const { initAnnouncementModal } = createAnnouncementModalActions({
      elements,
      getLocale: getCurrentLocale,
      onLocaleChange,
    });

    initAnnouncementModal();
    setCurrentLocale("en");

    expect(elements.announcementHistoryList?.children[0]).toHaveTextContent(
      latestAnnouncement?.history[0]?.changes[0]?.en ?? "",
    );
    expect(elements.announcementKnownIssuesList?.children[0]).toHaveTextContent(
      "There are no known issues listed right now.",
    );
    expect(elements.announcementFeedbackGithubLink).toHaveAttribute(
      "href",
      latestAnnouncement?.links.githubRepositoryUrl ?? "",
    );
    expect(elements.announcementFeedbackAuthorXLink).toHaveAttribute(
      "href",
      latestAnnouncement?.links.authorXUrl ?? "",
    );
    expect(elements.announcementGithubLink).toHaveTextContent(
      "GitHub repository",
    );
    expect(elements.announcementAuthorXLink).toHaveTextContent("Author on X");
  });
});
