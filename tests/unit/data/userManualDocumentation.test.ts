import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const USER_MANUAL_PATH = resolve(process.cwd(), "docs/user-manual.md");
const EXPECTED_SCREENSHOT_LINKS = [
  "./images/user-manual/desktop-overview.png",
  "./images/user-manual/mobile-basic.png",
  "./images/user-manual/preset-search.png",
  "./images/user-manual/face-text-settings.png",
  "./images/user-manual/face-list-overview.png",
  "./images/user-manual/face-list-table.png",
  "./images/user-manual/face-list-mobile-card.png",
  "./images/user-manual/face-list-add-face.png",
  "./images/user-manual/face-list-index-coefficient.png",
  "./images/user-manual/face-list-hidden-face.png",
  "./images/user-manual/face-list-expanded-row.png",
  "./images/user-manual/face-list-crystal-tabs.png",
  "./images/user-manual/mobile-output.png",
];

function readUserManual() {
  return readFileSync(USER_MANUAL_PATH, "utf8").replace(/^\uFEFF/, "");
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
  it("スクリーンショット付きマニュアルは必要な画像を参照する", () => {
    expect(parseMarkdownImageLinks(readUserManual())).toEqual(
      EXPECTED_SCREENSHOT_LINKS,
    );
  });

  it("スクリーンショット付きマニュアルの画像リンクは実ファイルを指す", () => {
    const manualDir = dirname(USER_MANUAL_PATH);

    parseMarkdownImageLinks(readUserManual()).forEach((link) => {
      expect(existsSync(resolve(manualDir, link))).toBe(true);
    });
  });

  it("ツール内で完結できるよう主要セクションを持つ", () => {
    expect(parseMarkdownHeadings(readUserManual())).toEqual([
      "1. はじめに",
      "2. まずこれだけ",
      "3. 基本チュートリアル",
      "4. 目的別ガイド",
      "5. 各機能の説明",
      "6. 困ったとき",
      "7. 補足",
    ]);
  });

  it("ボタン説明と面一覧の基本概念を本文で説明する", () => {
    const manual = readUserManual();

    expect(manual).toContain("主なボタンとメニュー");
    expect(manual).toContain("文字だけのボタンはスクリーンショットに頼らず");
    expect(manual).toContain("面指数 h / k / l の考え方");
    expect(manual).toContain("face-list-overview.png");
    expect(manual).toContain("face-list-table.png");
    expect(manual).toContain("face-list-mobile-card.png");
    expect(manual).toContain("face-list-index-coefficient.png");
    expect(manual).toContain("face-list-hidden-face.png");
    expect(manual).toContain("face-list-expanded-row.png");
    expect(manual).toContain("face-list-add-face.png");
    expect(manual).toContain("face-list-crystal-tabs.png");
    expect(manual).toContain("`h` を変える");
    expect(manual).toContain("a 軸の中心に近い位置");
    expect(manual).toContain("`0` の場合、その面は b 軸とは交わりません");
    expect(manual).toContain("負の場合は c 軸の負側");
    expect(manual).toContain("係数の考え方");
    expect(manual).toContain("基本的には面が大きくなります");
    expect(manual).toContain("基本的には面が小さくなります");
    expect(manual).toContain("i が出る結晶系");
    expect(manual).toContain("`i` は直接入力できず");
    expect(manual).toContain(
      "通常操作では、`i` を自分でそろえる必要はありません",
    );
    expect(manual).toContain("等価な面を作成");
  });
});
