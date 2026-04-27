import userManualMarkdown from "../../docs/user-manual.md?raw";
import desktopOverviewImageUrl from "../../docs/images/user-manual/desktop-overview.png";
import faceListAddFaceImageUrl from "../../docs/images/user-manual/face-list-add-face.png";
import faceListCrystalTabsImageUrl from "../../docs/images/user-manual/face-list-crystal-tabs.png";
import faceListExpandedRowImageUrl from "../../docs/images/user-manual/face-list-expanded-row.png";
import faceListHiddenFaceImageUrl from "../../docs/images/user-manual/face-list-hidden-face.png";
import faceListIndexCoefficientImageUrl from "../../docs/images/user-manual/face-list-index-coefficient.png";
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

const USER_MANUAL_IMAGE_URLS = new Map([
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
    "./images/user-manual/face-list-index-coefficient.png",
    faceListIndexCoefficientImageUrl,
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
]);

function normalizeMarkdown(markdown: string) {
  return markdown.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}

function resolveManualImageUrl(markdownPath: string) {
  return USER_MANUAL_IMAGE_URLS.get(markdownPath) ?? markdownPath;
}

export function parseUserManualMarkdown(markdown: string) {
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
        src: resolveManualImageUrl(imageMatch[2]),
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

export function getUserManualBlocks() {
  return parseUserManualMarkdown(userManualMarkdown);
}
