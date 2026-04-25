import changelogMarkdown from "../../docs/changelog.md?raw";
import knownIssuesMarkdown from "../../docs/known-issues.md?raw";
import type { SupportedLocale } from "../i18n.js";

export type LocalizedAnnouncementText = Record<SupportedLocale, string>;

export interface AnnouncementHistoryEntry {
  date: string;
  version: string;
  changes: LocalizedAnnouncementText[];
}

export interface AnnouncementEntry {
  id: string;
  updatedAt: string;
  history: AnnouncementHistoryEntry[];
  knownIssues: LocalizedAnnouncementText[];
  links: {
    githubRepositoryUrl: string;
    authorXUrl: string;
  };
}

interface ParsedAnnouncementSection {
  date: string;
  version: string;
  localizedItems: Record<SupportedLocale, string[]>;
}

const ANNOUNCEMENT_LOCALES: readonly SupportedLocale[] = ["ja", "en"];

function createAnnouncementMarkdownError(
  sourceName: string,
  lineNumber: number,
  message: string,
) {
  return new Error(`[announcement markdown:${sourceName}:${lineNumber}] ${message}`);
}

function stripMarkdownComments(markdown: string) {
  return markdown.replace(/<!--[\s\S]*?-->/g, "");
}

function createParsedAnnouncementSection(
  headingText: string,
  sourceName: string,
  lineNumber: number,
): ParsedAnnouncementSection {
  const headingMatch = headingText.match(/^(\d{4}-\d{2}-\d{2})\s*\/\s*(.+)$/);
  if (!headingMatch) {
    throw createAnnouncementMarkdownError(
      sourceName,
      lineNumber,
      "section heading must be `## YYYY-MM-DD / version`",
    );
  }

  return {
    date: headingMatch[1],
    version: headingMatch[2].trim(),
    localizedItems: {
      ja: [],
      en: [],
    },
  };
}

function finalizeParsedAnnouncementSection(
  section: ParsedAnnouncementSection,
  sourceName: string,
) {
  const counts = ANNOUNCEMENT_LOCALES.map(
    (locale) => section.localizedItems[locale].length,
  );

  if (counts.some((count) => count === 0)) {
    throw createAnnouncementMarkdownError(
      sourceName,
      1,
      `section ${section.date} / ${section.version} must include both ### ja and ### en bullet lists`,
    );
  }

  if (new Set(counts).size !== 1) {
    throw createAnnouncementMarkdownError(
      sourceName,
      1,
      `section ${section.date} / ${section.version} must keep ### ja and ### en bullet counts aligned`,
    );
  }
}

function parseAnnouncementSections(markdown: string, sourceName: string) {
  const lines = stripMarkdownComments(markdown).replace(/\r\n?/g, "\n").split("\n");
  const sections: ParsedAnnouncementSection[] = [];
  let currentSection: ParsedAnnouncementSection | null = null;
  let currentLocale: SupportedLocale | null = null;

  function flushCurrentSection() {
    if (!currentSection) {
      return;
    }
    finalizeParsedAnnouncementSection(currentSection, sourceName);
    sections.push(currentSection);
  }

  lines.forEach((rawLine, index) => {
    const lineNumber = index + 1;
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) {
      return;
    }

    const sectionHeadingMatch = trimmedLine.match(/^##\s+(.+)$/);
    if (sectionHeadingMatch) {
      flushCurrentSection();
      currentSection = createParsedAnnouncementSection(
        sectionHeadingMatch[1],
        sourceName,
        lineNumber,
      );
      currentLocale = null;
      return;
    }

    const localeHeadingMatch = trimmedLine.match(/^###\s+(ja|en)\s*$/);
    if (localeHeadingMatch) {
      if (!currentSection) {
        throw createAnnouncementMarkdownError(
          sourceName,
          lineNumber,
          "locale headings must appear under a section heading",
        );
      }
      currentLocale = localeHeadingMatch[1] as SupportedLocale;
      return;
    }

    const bulletMatch = trimmedLine.match(/^-\s+(.+)$/);
    if (bulletMatch) {
      if (!currentSection || !currentLocale) {
        throw createAnnouncementMarkdownError(
          sourceName,
          lineNumber,
          "bullet items must appear under ### ja or ### en",
        );
      }
      currentSection.localizedItems[currentLocale].push(bulletMatch[1].trim());
      return;
    }

    if (currentSection) {
      throw createAnnouncementMarkdownError(
        sourceName,
        lineNumber,
        "only bullet list items are supported inside announcement sections",
      );
    }
  });

  flushCurrentSection();
  return sections;
}

export function parseAnnouncementHistoryMarkdown(
  markdown: string,
  sourceName = "docs/changelog.md",
) {
  return parseAnnouncementSections(markdown, sourceName).map((section) => ({
    date: section.date,
    version: section.version,
    changes: section.localizedItems.ja.map((jaText, index) => ({
      ja: jaText,
      en: section.localizedItems.en[index],
    })),
  }));
}

export function parseAnnouncementKnownIssuesMarkdown(
  markdown: string,
  sourceName = "docs/known-issues.md",
) {
  return parseAnnouncementSections(markdown, sourceName).flatMap((section) =>
    section.localizedItems.ja.map((jaText, index) => ({
      ja: jaText,
      en: section.localizedItems.en[index],
    })),
  );
}

/**
 * お知らせは docs/ 配下の公開用 markdown を正本にして構成する。
 *
 * `updatedAt` と外部リンクだけを code 側で持ち、本文の更新履歴と既知の問題は
 * public docs の markdown を参照する。
 */
export const ANNOUNCEMENTS: readonly AnnouncementEntry[] = [
  {
    id: "2026-04-26-notice-board",
    updatedAt: "2026-04-26T05:15:00+09:00",
    history: parseAnnouncementHistoryMarkdown(changelogMarkdown),
    knownIssues: parseAnnouncementKnownIssuesMarkdown(knownIssuesMarkdown),
    links: {
      githubRepositoryUrl: "https://github.com/Wfrm-Qz/sekiei",
      authorXUrl: "https://x.com/Wfrm_Qz",
    },
  },
];

export function getLatestAnnouncement() {
  return ANNOUNCEMENTS[0] ?? null;
}

export function getLocalizedAnnouncementText(
  text: LocalizedAnnouncementText,
  locale: SupportedLocale,
) {
  return text[locale] ?? text.ja;
}
