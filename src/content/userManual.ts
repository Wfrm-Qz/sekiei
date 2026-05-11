import userManualEnMarkdown from "../../docs/user-manual.en.md?raw";
import userManualJaMarkdown from "../../docs/user-manual.md?raw";
import type { SupportedLocale } from "../i18n.js";
import desktopOverviewImageUrl from "../../docs/images/user-manual/desktop-overview.png";
import enDesktopOverviewImageUrl from "../../docs/images/user-manual/en/desktop-overview.png";
import enFaceListAddFaceImageUrl from "../../docs/images/user-manual/en/face-list-add-face.png";
import enFaceListCrystalTabsImageUrl from "../../docs/images/user-manual/en/face-list-crystal-tabs.png";
import enFaceListExpandedRowImageUrl from "../../docs/images/user-manual/en/face-list-expanded-row.png";
import enFaceListHiddenFaceImageUrl from "../../docs/images/user-manual/en/face-list-hidden-face.png";
import enFaceListIndexDistanceImageUrl from "../../docs/images/user-manual/en/face-list-index-distance.png";
import enFaceListMobileCardImageUrl from "../../docs/images/user-manual/en/face-list-mobile-card.png";
import enFaceListOverviewImageUrl from "../../docs/images/user-manual/en/face-list-overview.png";
import enFaceListTableImageUrl from "../../docs/images/user-manual/en/face-list-table.png";
import enFaceTextSettingsImageUrl from "../../docs/images/user-manual/en/face-text-settings.png";
import enMobileBasicImageUrl from "../../docs/images/user-manual/en/mobile-basic.png";
import enMobileOutputImageUrl from "../../docs/images/user-manual/en/mobile-output.png";
import enPresetSearchImageUrl from "../../docs/images/user-manual/en/preset-search.png";
import faceListAddFaceImageUrl from "../../docs/images/user-manual/face-list-add-face.png";
import faceListCrystalTabsImageUrl from "../../docs/images/user-manual/face-list-crystal-tabs.png";
import faceListExpandedRowImageUrl from "../../docs/images/user-manual/face-list-expanded-row.png";
import faceListHiddenFaceImageUrl from "../../docs/images/user-manual/face-list-hidden-face.png";
import faceListIndexDistanceImageUrl from "../../docs/images/user-manual/face-list-index-distance.png";
import faceListMobileCardImageUrl from "../../docs/images/user-manual/face-list-mobile-card.png";
import faceListOverviewImageUrl from "../../docs/images/user-manual/face-list-overview.png";
import faceListTableImageUrl from "../../docs/images/user-manual/face-list-table.png";
import faceTextSettingsImageUrl from "../../docs/images/user-manual/face-text-settings.png";
import mobileBasicImageUrl from "../../docs/images/user-manual/mobile-basic.png";
import mobileOutputImageUrl from "../../docs/images/user-manual/mobile-output.png";
import presetSearchImageUrl from "../../docs/images/user-manual/preset-search.png";

export type UserManualBlock =
  | {
      type: "heading";
      level: number;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "image";
      alt: string;
      src: string;
    }
  | {
      type: "list";
      ordered: boolean;
      items: {
        text: string;
        indent: number;
      }[];
    };

const USER_MANUAL_MARKDOWN: Record<SupportedLocale, string> = {
  ja: userManualJaMarkdown,
  en: userManualEnMarkdown,
};

const USER_MANUAL_IMAGE_URLS: Record<SupportedLocale, Map<string, string>> = {
  ja: new Map([
    ["./images/user-manual/desktop-overview.png", desktopOverviewImageUrl],
    ["./images/user-manual/mobile-basic.png", mobileBasicImageUrl],
    ["./images/user-manual/preset-search.png", presetSearchImageUrl],
    ["./images/user-manual/face-list-overview.png", faceListOverviewImageUrl],
    ["./images/user-manual/face-list-table.png", faceListTableImageUrl],
    [
      "./images/user-manual/face-list-mobile-card.png",
      faceListMobileCardImageUrl,
    ],
    [
      "./images/user-manual/face-list-index-distance.png",
      faceListIndexDistanceImageUrl,
    ],
    [
      "./images/user-manual/face-list-hidden-face.png",
      faceListHiddenFaceImageUrl,
    ],
    [
      "./images/user-manual/face-list-expanded-row.png",
      faceListExpandedRowImageUrl,
    ],
    ["./images/user-manual/face-text-settings.png", faceTextSettingsImageUrl],
    ["./images/user-manual/face-list-add-face.png", faceListAddFaceImageUrl],
    [
      "./images/user-manual/face-list-crystal-tabs.png",
      faceListCrystalTabsImageUrl,
    ],
    ["./images/user-manual/mobile-output.png", mobileOutputImageUrl],
  ]),
  en: new Map([
    ["./images/user-manual/en/desktop-overview.png", enDesktopOverviewImageUrl],
    ["./images/user-manual/en/mobile-basic.png", enMobileBasicImageUrl],
    ["./images/user-manual/en/preset-search.png", enPresetSearchImageUrl],
    [
      "./images/user-manual/en/face-list-overview.png",
      enFaceListOverviewImageUrl,
    ],
    ["./images/user-manual/en/face-list-table.png", enFaceListTableImageUrl],
    [
      "./images/user-manual/en/face-list-mobile-card.png",
      enFaceListMobileCardImageUrl,
    ],
    [
      "./images/user-manual/en/face-list-index-distance.png",
      enFaceListIndexDistanceImageUrl,
    ],
    [
      "./images/user-manual/en/face-list-hidden-face.png",
      enFaceListHiddenFaceImageUrl,
    ],
    [
      "./images/user-manual/en/face-list-expanded-row.png",
      enFaceListExpandedRowImageUrl,
    ],
    [
      "./images/user-manual/en/face-text-settings.png",
      enFaceTextSettingsImageUrl,
    ],
    [
      "./images/user-manual/en/face-list-add-face.png",
      enFaceListAddFaceImageUrl,
    ],
    [
      "./images/user-manual/en/face-list-crystal-tabs.png",
      enFaceListCrystalTabsImageUrl,
    ],
    ["./images/user-manual/en/mobile-output.png", enMobileOutputImageUrl],
  ]),
};

function normalizeMarkdown(markdown: string) {
  return markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function resolveManualImageUrl(
  markdownPath: string,
  imageUrls: Map<string, string>,
) {
  return imageUrls.get(markdownPath) ?? markdownPath;
}

export function parseUserManualMarkdown(
  markdown: string,
  imageUrls = USER_MANUAL_IMAGE_URLS.ja,
) {
  const lines = normalizeMarkdown(markdown).split("\n");
  const blocks: UserManualBlock[] = [];
  let pendingParagraph: string[] = [];
  let pendingList: {
    ordered: boolean;
    items: {
      text: string;
      indent: number;
    }[];
  } | null = null;

  function flushParagraph() {
    if (pendingParagraph.length === 0) {
      return;
    }
    blocks.push({
      type: "paragraph",
      text: pendingParagraph.join(" ").trim(),
    });
    pendingParagraph = [];
  }

  function flushList() {
    if (!pendingList) {
      return;
    }
    blocks.push({
      type: "list",
      ordered: pendingList.ordered,
      items: pendingList.items,
    });
    pendingList = null;
  }

  lines.forEach((line) => {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      flushParagraph();
      flushList();
      return;
    }

    const imageMatch = trimmedLine.match(/^!\[([^\]]*)]\(([^)]+)\)$/);
    if (imageMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "image",
        alt: imageMatch[1],
        src: resolveManualImageUrl(imageMatch[2], imageUrls),
      });
      return;
    }

    const headingMatch = trimmedLine.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        text: headingMatch[2].trim(),
      });
      return;
    }

    const listMatch = line.match(/^(\s*)(?:([-*])|(\d+\.))\s+(.+)$/);
    if (listMatch) {
      flushParagraph();
      const ordered = Boolean(listMatch[3]);
      if (!pendingList || pendingList.ordered !== ordered) {
        flushList();
        pendingList = {
          ordered,
          items: [],
        };
      }
      pendingList.items.push({
        text: listMatch[4].trim(),
        indent: Math.floor(listMatch[1].length / 2),
      });
      return;
    }

    flushList();
    pendingParagraph.push(trimmedLine);
  });

  flushParagraph();
  flushList();
  return blocks;
}

export function getUserManualBlocks(locale: SupportedLocale = "ja") {
  return parseUserManualMarkdown(
    USER_MANUAL_MARKDOWN[locale],
    USER_MANUAL_IMAGE_URLS[locale],
  );
}
