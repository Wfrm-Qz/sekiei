import { t, type SupportedLocale } from "../../i18n.js";
import {
  getLatestAnnouncement,
  getLocalizedAnnouncementText,
  type AnnouncementEntry,
  type AnnouncementHistoryEntry,
} from "../../content/announcements.js";

export const ANNOUNCEMENT_STORAGE_KEY = "sekiei.announcement.lastSeenRevision";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

interface AnnouncementModalElementsLike {
  announcementModal: HTMLElement | null;
  announcementBackdrop: HTMLElement | null;
  announcementUpdatedAtValue: HTMLElement | null;
  announcementHistoryList: HTMLElement | null;
  announcementKnownIssuesList: HTMLElement | null;
  announcementFeedbackGithubLink: HTMLAnchorElement | null;
  announcementFeedbackAuthorXLink: HTMLAnchorElement | null;
  announcementGithubLink: HTMLAnchorElement | null;
  announcementAuthorXLink: HTMLAnchorElement | null;
  announcementDismissButton: HTMLButtonElement | null;
  announcementCloseButton: HTMLButtonElement | null;
}

interface AnnouncementModalContext {
  elements: AnnouncementModalElementsLike;
  getLocale: () => SupportedLocale;
  onLocaleChange: (listener: (locale: SupportedLocale) => void) => () => void;
  storage?: StorageLike | null;
  documentRef?: Document;
}

function resolveStorage(storage?: StorageLike | null) {
  if (storage !== undefined) {
    return storage;
  }
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function parseAnnouncementDate(value: string) {
  const isoDate = new Date(value);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }
  const [year, month, day] = value.split("-").map((part) => Number(part));
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day)
  ) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

function formatAnnouncementDate(value: string, locale: SupportedLocale) {
  const parsedDate = parseAnnouncementDate(value);
  if (!parsedDate) {
    return value;
  }
  return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: locale === "ja" ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(parsedDate);
}

function getAnnouncementRevisionToken(announcement: AnnouncementEntry) {
  return `${announcement.id}::${announcement.updatedAt}`;
}

function isSeenWithLegacyId(
  storedValue: string | null,
  announcement: AnnouncementEntry,
) {
  return (
    storedValue === announcement.id &&
    announcement.updatedAt.startsWith(announcement.history[0]?.date ?? "")
  );
}

function buildHistoryEntryElement(
  documentRef: Document,
  locale: SupportedLocale,
  historyEntry: AnnouncementHistoryEntry,
) {
  const article = documentRef.createElement("article");
  article.className = "announcement-history-entry";

  const meta = documentRef.createElement("div");
  meta.className = "announcement-history-entry__meta";

  const time = documentRef.createElement("time");
  time.className = "announcement-history-entry__date";
  time.textContent = formatAnnouncementDate(historyEntry.date, locale);

  const version = documentRef.createElement("span");
  version.className = "announcement-history-entry__version";
  version.textContent = historyEntry.version;

  meta.append(time, version);

  const list = documentRef.createElement("ul");
  list.className = "announcement-list";
  historyEntry.changes.forEach((change) => {
    const item = documentRef.createElement("li");
    item.textContent = getLocalizedAnnouncementText(change, locale);
    list.append(item);
  });

  article.append(meta, list);
  return article;
}

function setAnnouncementLink(
  linkElement: HTMLAnchorElement | null,
  url: string,
  locale: SupportedLocale,
  fallbackLabelKey: string,
) {
  if (!linkElement) {
    return;
  }
  const label = t(fallbackLabelKey, {}, locale);
  linkElement.setAttribute("title", label);
  linkElement.setAttribute("aria-label", label);
  const hiddenLabel = linkElement.querySelector(".visually-hidden");
  if (hiddenLabel) {
    hiddenLabel.textContent = label;
  }
  if (!url) {
    linkElement.removeAttribute("href");
    linkElement.removeAttribute("target");
    linkElement.removeAttribute("rel");
    linkElement.setAttribute("aria-disabled", "true");
    linkElement.classList.add("announcement-link--disabled");
    return;
  }
  linkElement.href = url;
  linkElement.target = "_blank";
  linkElement.rel = "noreferrer";
  linkElement.removeAttribute("aria-disabled");
  linkElement.classList.remove("announcement-link--disabled");
}

export function shouldShowAnnouncement(
  announcement: AnnouncementEntry | null,
  storage = resolveStorage(),
) {
  if (!announcement) {
    return false;
  }
  const lastSeenRevision = storage?.getItem(ANNOUNCEMENT_STORAGE_KEY) ?? null;
  const currentRevision = getAnnouncementRevisionToken(announcement);
  return (
    lastSeenRevision !== currentRevision &&
    !isSeenWithLegacyId(lastSeenRevision, announcement)
  );
}

export function createAnnouncementModalActions(
  context: AnnouncementModalContext,
) {
  const storage = resolveStorage(context.storage);
  const documentRef = context.documentRef ?? document;
  const latestAnnouncement = getLatestAnnouncement();
  let lastFocusedElement: Element | null = null;
  let initialized = false;

  function renderAnnouncementContent(announcement = latestAnnouncement) {
    if (!announcement) {
      return;
    }
    const locale = context.getLocale();
    const {
      announcementUpdatedAtValue,
      announcementHistoryList,
      announcementKnownIssuesList,
      announcementFeedbackGithubLink,
      announcementFeedbackAuthorXLink,
      announcementGithubLink,
      announcementAuthorXLink,
    } = context.elements;
    if (
      !announcementUpdatedAtValue ||
      !announcementHistoryList ||
      !announcementKnownIssuesList
    ) {
      return;
    }

    announcementUpdatedAtValue.textContent = formatAnnouncementDate(
      announcement.updatedAt,
      locale,
    );

    const historyFragment = documentRef.createDocumentFragment();
    announcement.history.forEach((historyEntry) => {
      historyFragment.append(
        buildHistoryEntryElement(documentRef, locale, historyEntry),
      );
    });
    announcementHistoryList.replaceChildren(historyFragment);

    const issuesFragment = documentRef.createDocumentFragment();
    if (announcement.knownIssues.length === 0) {
      const item = documentRef.createElement("li");
      item.className = "announcement-list__empty";
      item.textContent = t("announcement.noKnownIssues", {}, locale);
      issuesFragment.append(item);
    } else {
      announcement.knownIssues.forEach((issue) => {
        const item = documentRef.createElement("li");
        item.textContent = getLocalizedAnnouncementText(issue, locale);
        issuesFragment.append(item);
      });
    }
    announcementKnownIssuesList.replaceChildren(issuesFragment);

    setAnnouncementLink(
      announcementFeedbackGithubLink,
      announcement.links.githubRepositoryUrl,
      locale,
      "announcement.githubLink",
    );
    setAnnouncementLink(
      announcementFeedbackAuthorXLink,
      announcement.links.authorXUrl,
      locale,
      "announcement.authorXLink",
    );
    setAnnouncementLink(
      announcementGithubLink,
      announcement.links.githubRepositoryUrl,
      locale,
      "announcement.githubLink",
    );
    setAnnouncementLink(
      announcementAuthorXLink,
      announcement.links.authorXUrl,
      locale,
      "announcement.authorXLink",
    );
  }

  function openAnnouncement(announcement = latestAnnouncement) {
    const { announcementModal, announcementDismissButton } = context.elements;
    if (!announcementModal || !announcement) {
      return;
    }
    renderAnnouncementContent(announcement);
    lastFocusedElement = documentRef.activeElement;
    announcementModal.hidden = false;
    documentRef.body.classList.add("announcement-modal-open");
    announcementDismissButton?.focus();
  }

  function closeAnnouncement(options?: { markSeen?: boolean }) {
    const { announcementModal } = context.elements;
    if (!announcementModal || announcementModal.hidden) {
      return;
    }
    if (options?.markSeen !== false && latestAnnouncement) {
      storage?.setItem(
        ANNOUNCEMENT_STORAGE_KEY,
        getAnnouncementRevisionToken(latestAnnouncement),
      );
    }
    announcementModal.hidden = true;
    documentRef.body.classList.remove("announcement-modal-open");
    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
    lastFocusedElement = null;
  }

  function handleDocumentKeydown(event: KeyboardEvent) {
    if (event.key !== "Escape") {
      return;
    }
    if (context.elements.announcementModal?.hidden) {
      return;
    }
    event.preventDefault();
    closeAnnouncement();
  }

  function initAnnouncementModal() {
    if (initialized) {
      return;
    }
    initialized = true;
    const {
      announcementBackdrop,
      announcementCloseButton,
      announcementDismissButton,
    } = context.elements;

    if (latestAnnouncement) {
      renderAnnouncementContent(latestAnnouncement);
    }
    announcementBackdrop?.addEventListener("click", () => closeAnnouncement());
    announcementCloseButton?.addEventListener("click", () =>
      closeAnnouncement(),
    );
    announcementDismissButton?.addEventListener("click", () =>
      closeAnnouncement(),
    );
    documentRef.addEventListener("keydown", handleDocumentKeydown);
    context.onLocaleChange(() => {
      renderAnnouncementContent(latestAnnouncement);
    });

    if (shouldShowAnnouncement(latestAnnouncement, storage)) {
      openAnnouncement(latestAnnouncement);
    }
  }

  return {
    closeAnnouncement,
    initAnnouncementModal,
    openAnnouncement,
    renderAnnouncementContent,
  };
}
