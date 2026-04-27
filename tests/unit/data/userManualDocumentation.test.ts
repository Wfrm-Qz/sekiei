import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const USER_MANUAL_PATH = resolve(process.cwd(), "docs/user-manual.md");
const EXPECTED_SCREENSHOT_LINKS = [
  "./images/user-manual/desktop-overview.png",
  "./images/user-manual/mobile-basic.png",
  "./images/user-manual/preset-search.png",
  "./images/user-manual/face-text-settings.png",
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
});
