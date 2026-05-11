import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const USER_MANUAL_PATH = resolve(process.cwd(), "docs/user-manual.md");
const USER_MANUAL_EN_PATH = resolve(process.cwd(), "docs/user-manual.en.md");
const EXPECTED_SCREENSHOT_LINKS = [
  "./images/user-manual/desktop-overview.png",
  "./images/user-manual/mobile-basic.png",
  "./images/user-manual/preset-search.png",
  "./images/user-manual/face-text-settings.png",
  "./images/user-manual/face-list-overview.png",
  "./images/user-manual/face-list-table.png",
  "./images/user-manual/face-list-mobile-card.png",
  "./images/user-manual/face-list-add-face.png",
  "./images/user-manual/face-list-index-distance.png",
  "./images/user-manual/face-list-hidden-face.png",
  "./images/user-manual/face-list-expanded-row.png",
  "./images/user-manual/face-list-crystal-tabs.png",
  "./images/user-manual/mobile-output.png",
];
const EXPECTED_EN_SCREENSHOT_LINKS = EXPECTED_SCREENSHOT_LINKS.map((link) =>
  link.replace("./images/user-manual/", "./images/user-manual/en/"),
);

function readMarkdown(path: string) {
  return readFileSync(path, "utf8").replace(/^\uFEFF/, "");
}

function parseMarkdownImageLinks(markdown: string) {
  return Array.from(markdown.matchAll(/!\[[^\]]*]\(([^)]+)\)/g)).map(
    (match) => match[1],
  );
}

function parseMarkdownHeadings(markdown: string) {
  return Array.from(markdown.matchAll(/^##\s+(.+)$/gm)).map(
    (match) => match[1],
  );
}

describe("user manual documentation", () => {
  it("日本語マニュアルは必要な画像を参照する", () => {
    expect(parseMarkdownImageLinks(readMarkdown(USER_MANUAL_PATH))).toEqual(
      EXPECTED_SCREENSHOT_LINKS,
    );
  });

  it("英語マニュアルは英語 UI 画像を参照する", () => {
    expect(parseMarkdownImageLinks(readMarkdown(USER_MANUAL_EN_PATH))).toEqual(
      EXPECTED_EN_SCREENSHOT_LINKS,
    );
  });

  it.each([
    [USER_MANUAL_PATH, EXPECTED_SCREENSHOT_LINKS],
    [USER_MANUAL_EN_PATH, EXPECTED_EN_SCREENSHOT_LINKS],
  ])(
    "スクリーンショット付きマニュアルの画像リンクは実ファイルを指す",
    (manualPath, expectedLinks) => {
      const manualDir = dirname(USER_MANUAL_PATH);

      parseMarkdownImageLinks(readMarkdown(manualPath)).forEach((link) => {
        expect(expectedLinks).toContain(link);
        expect(existsSync(resolve(manualDir, link))).toBe(true);
      });
    },
  );

  it("日本語マニュアルはツール内で完結できるよう主要セクションを持つ", () => {
    expect(parseMarkdownHeadings(readMarkdown(USER_MANUAL_PATH))).toEqual([
      "1. はじめに",
      "2. まずこれだけ",
      "3. 基本チュートリアル",
      "4. 目的別ガイド",
      "5. 各機能の説明",
      "6. 困ったとき",
      "7. 補足",
    ]);
  });

  it("英語マニュアルは日本語版と同じ主要セクションを持つ", () => {
    expect(parseMarkdownHeadings(readMarkdown(USER_MANUAL_EN_PATH))).toEqual([
      "1. Getting Started",
      "2. Quick Start",
      "3. Basic Tutorials",
      "4. Task Guides",
      "5. Feature Reference",
      "6. Troubleshooting",
      "7. Notes",
    ]);
  });

  it("ボタン説明と面一覧の基本概念を本文で説明する", () => {
    const manual = readMarkdown(USER_MANUAL_PATH);

    expect(manual).toContain("主なボタンとメニュー");
    expect(manual).toContain("文字だけのボタンはスクリーンショットに頼らず");
    expect(manual).toContain("面指数 h / k / l の考え方");
    expect(manual).toContain("face-list-overview.png");
    expect(manual).toContain("face-list-table.png");
    expect(manual).toContain("face-list-mobile-card.png");
    expect(manual).toContain("face-list-index-distance.png");
    expect(manual).toContain("face-list-hidden-face.png");
    expect(manual).toContain("face-list-expanded-row.png");
    expect(manual).toContain("face-list-add-face.png");
    expect(manual).toContain("face-list-crystal-tabs.png");
    expect(manual).toContain("`h` を変える");
    expect(manual).toContain("a 軸の中心に近い位置");
    expect(manual).toContain("`0` の場合、その面は b 軸とは交わりません");
    expect(manual).toContain("負の場合は c 軸の負側");
    expect(manual).toContain("距離の考え方");
    expect(manual).toContain("基本的には面が大きくなります");
    expect(manual).toContain("基本的には面が小さくなります");
    expect(manual).toContain("閉じた立体になる場合だけ使えます");
    expect(manual).toContain("i が出る結晶系");
    expect(manual).toContain("`i` は直接入力できず");
    expect(manual).toContain(
      "通常操作では、`i` を自分でそろえる必要はありません",
    );
    expect(manual).toContain("等価な面を作成");
  });

  it("英語マニュアルもボタン説明と面一覧の基本概念を本文で説明する", () => {
    const manual = readMarkdown(USER_MANUAL_EN_PATH);

    expect(manual).toContain("Main Buttons and Menus");
    expect(manual).toContain("instead of relying on button-only screenshots");
    expect(manual).toContain("Understanding h / k / l Face Indices");
    expect(manual).toContain("face-list-overview.png");
    expect(manual).toContain("face-list-table.png");
    expect(manual).toContain("face-list-mobile-card.png");
    expect(manual).toContain("face-list-index-distance.png");
    expect(manual).toContain("face-list-hidden-face.png");
    expect(manual).toContain("face-list-expanded-row.png");
    expect(manual).toContain("face-list-add-face.png");
    expect(manual).toContain("face-list-crystal-tabs.png");
    expect(manual).toContain("Change `h`");
    expect(manual).toContain("closer to the center along the a-axis direction");
    expect(manual).toContain(
      "When `k` is `0`, the face does not intersect the b axis",
    );
    expect(manual).toContain(
      "Positive values intersect the positive side of the c axis; negative values intersect the negative side",
    );
    expect(manual).toContain("Understanding Distance");
    expect(manual).toContain("the face itself becomes larger");
    expect(manual).toContain("the face itself becomes smaller");
    expect(manual).toContain("form a closed solid");
    expect(manual).toContain("Crystal Systems That Show i");
    expect(manual).toContain("`i` is read-only");
    expect(manual).toContain("you do not need to adjust `i` yourself");
    expect(manual).toContain("Create Equivalent Faces");
  });
});
