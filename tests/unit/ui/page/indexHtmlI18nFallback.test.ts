import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { t } from "../../../../src/i18n.ts";

function normalizeText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function loadIndexHtmlDocument() {
  const htmlPath = resolve(process.cwd(), "index.html");
  const html = readFileSync(htmlPath, "utf8");
  const parser = new DOMParser();
  return parser.parseFromString(html, "text/html");
}

describe("ui/page/indexHtml i18n fallback", () => {
  it("data-i18n の fallback text は日本語辞書と一致する", () => {
    const document = loadIndexHtmlDocument();
    const mismatches = Array.from(document.querySelectorAll("[data-i18n]"))
      .map((element) => {
        const key = element.getAttribute("data-i18n");
        return {
          key,
          actual: normalizeText(element.textContent),
          expected: normalizeText(t(key ?? "", {}, "ja")),
        };
      })
      .filter(({ actual, expected }) => actual !== expected);

    expect(mismatches).toEqual([]);
  });

  it("data-i18n-placeholder の fallback placeholder は日本語辞書と一致する", () => {
    const document = loadIndexHtmlDocument();
    const mismatches = Array.from(
      document.querySelectorAll("[data-i18n-placeholder]"),
    )
      .map((element) => {
        const key = element.getAttribute("data-i18n-placeholder");
        return {
          key,
          actual: normalizeText(element.getAttribute("placeholder")),
          expected: normalizeText(t(key ?? "", {}, "ja")),
        };
      })
      .filter(({ actual, expected }) => actual !== expected);

    expect(mismatches).toEqual([]);
  });

  it("data-i18n-aria-label の fallback aria-label は日本語辞書と一致する", () => {
    const document = loadIndexHtmlDocument();
    const mismatches = Array.from(
      document.querySelectorAll("[data-i18n-aria-label]"),
    )
      .map((element) => {
        const key = element.getAttribute("data-i18n-aria-label");
        return {
          key,
          actual: normalizeText(element.getAttribute("aria-label")),
          expected: normalizeText(t(key ?? "", {}, "ja")),
        };
      })
      .filter(({ actual, expected }) => actual !== expected);

    expect(mismatches).toEqual([]);
  });
});
