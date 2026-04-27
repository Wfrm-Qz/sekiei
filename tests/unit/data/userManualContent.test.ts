import { describe, expect, it } from "vitest";

import {
  getUserManualBlocks,
  parseUserManualMarkdown,
} from "../../../src/content/userManual.ts";

describe("user manual content", () => {
  it("docs/user-manual.md をアプリ内表示用 block に変換する", () => {
    const blocks = getUserManualBlocks("ja");

    expect(blocks[0]).toEqual({
      type: "heading",
      level: 1,
      text: "User Manual",
    });
    expect(
      blocks.some(
        (block) => block.type === "heading" && block.text === "1. はじめに",
      ),
    ).toBe(true);
    expect(blocks.some((block) => block.type === "paragraph")).toBe(true);
    expect(blocks.some((block) => block.type === "list")).toBe(true);
  });

  it("docs/user-manual.en.md を英語 UI 用 block に変換する", () => {
    const blocks = getUserManualBlocks("en");

    expect(blocks[0]).toEqual({
      type: "heading",
      level: 1,
      text: "User Manual",
    });
    expect(
      blocks.some(
        (block) =>
          block.type === "heading" && block.text === "1. Getting Started",
      ),
    ).toBe(true);
    expect(
      blocks.some(
        (block) =>
          block.type === "paragraph" &&
          block.text.includes("This guide is for people using Sekiei"),
      ),
    ).toBe(true);
  });

  it.each(["ja", "en"] as const)(
    "%s のマニュアル画像は bundle 可能な asset URL へ解決する",
    (locale) => {
      const imageBlocks = getUserManualBlocks(locale).filter(
        (block) => block.type === "image",
      );

      expect(imageBlocks).toHaveLength(13);
      imageBlocks.forEach((block) => {
        expect(block.src).not.toMatch(/^\.\/images\//);
        expect(block.alt).not.toBe("");
      });
    },
  );

  it("番号付きリストと入れ子風の箇条書きを保持する", () => {
    const blocks = parseUserManualMarkdown(
      [
        "# Sample",
        "",
        "1. First",
        "2. Second",
        "",
        "- Parent",
        "  - Child",
      ].join("\n"),
    );

    expect(blocks).toEqual([
      { type: "heading", level: 1, text: "Sample" },
      {
        type: "list",
        ordered: true,
        items: [
          { text: "First", indent: 0 },
          { text: "Second", indent: 0 },
        ],
      },
      {
        type: "list",
        ordered: false,
        items: [
          { text: "Parent", indent: 0 },
          { text: "Child", indent: 1 },
        ],
      },
    ]);
  });
});
