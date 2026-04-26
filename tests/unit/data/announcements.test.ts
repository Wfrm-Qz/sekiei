import { describe, expect, it } from "vitest";

import {
  getLatestAnnouncement,
  parseAnnouncementHistoryMarkdown,
  parseAnnouncementKnownIssuesMarkdown,
} from "../../../src/content/announcements.ts";

describe("content/announcements", () => {
  it("parses localized changelog sections from markdown", () => {
    const history = parseAnnouncementHistoryMarkdown(`
# Changelog

## 2026-04-26 / v0.1.2

### ja
- 更新 1
- 更新 2

### en
- Update 1
- Update 2
`);

    expect(history).toEqual([
      {
        date: "2026-04-26",
        version: "v0.1.2",
        changes: [
          { ja: "更新 1", en: "Update 1" },
          { ja: "更新 2", en: "Update 2" },
        ],
      },
    ]);
  });

  it("parses known issues from markdown and flattens localized entries", () => {
    const issues = parseAnnouncementKnownIssuesMarkdown(`
# Known Issues

## 2026-04-26 / v0.1.2

### ja
- 問題 1
- 問題 2

### en
- Issue 1
- Issue 2
`);

    expect(issues).toEqual([
      { ja: "問題 1", en: "Issue 1" },
      { ja: "問題 2", en: "Issue 2" },
    ]);
  });

  it("rejects sections where ja and en bullet counts drift apart", () => {
    expect(() =>
      parseAnnouncementHistoryMarkdown(`
## 2026-04-26 / v0.1.2

### ja
- 更新 1
- 更新 2

### en
- Update 1
`),
    ).toThrow(/bullet counts aligned/);
  });

  it("loads the latest announcement content from public docs", () => {
    const latestAnnouncement = getLatestAnnouncement();

    expect(latestAnnouncement?.history.length).toBeGreaterThan(0);
    expect(latestAnnouncement?.history[0]?.version).toBe("v0.1.3");
    expect(latestAnnouncement?.knownIssues).toEqual([]);
  });
});
