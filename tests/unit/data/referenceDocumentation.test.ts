import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const PRESET_DIR = resolve(process.cwd(), "src/data/presets");
const REFERENCE_MD_PATH = resolve(process.cwd(), "reference.md");
const NO_EXTERNAL_REFERENCE_NOTE = "外部出典なし（基本形状プリセット）";
const DEFAULT_REFERENCE_SECTION = "Face";

interface ReferenceSection {
  heading: string;
  lines: string[];
}

interface ReferenceEntry {
  presetId: string;
  sections: ReferenceSection[];
}

function normalizeReferenceLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function parseReferenceSections(referenceText: string): ReferenceSection[] {
  const sectionOrder: string[] = [];
  const sectionLines = new Map<string, string[]>();
  const lines = referenceText
    .split(/\r?\n/)
    .map((line) => normalizeReferenceLine(line))
    .filter(Boolean);

  if (lines.length === 0) {
    return [
      {
        heading: DEFAULT_REFERENCE_SECTION,
        lines: [normalizeReferenceLine(NO_EXTERNAL_REFERENCE_NOTE)],
      },
    ];
  }

  lines.forEach((line) => {
    const matchedSection = line.match(/^([^:]+)\s*:\s*(.+)$/);
    const heading = matchedSection?.[1]?.trim() ?? DEFAULT_REFERENCE_SECTION;
    const detail = matchedSection?.[2] ?? line;

    if (!sectionLines.has(heading)) {
      sectionOrder.push(heading);
      sectionLines.set(heading, []);
    }

    sectionLines.get(heading)?.push(normalizeReferenceLine(detail));
  });

  return sectionOrder.map((heading) => ({
    heading,
    lines: sectionLines.get(heading) ?? [],
  }));
}

function loadPresetReferenceEntries(): ReferenceEntry[] {
  return readdirSync(PRESET_DIR, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const document = JSON.parse(
        readFileSync(resolve(PRESET_DIR, entry.name), "utf8").replace(
          /^\uFEFF/,
          "",
        ),
      );
      const presetId =
        document?.parameters?.presetId ?? entry.name.replace(/\.json$/i, "");
      const fullReference = String(
        document?.parameters?.metadata?.fullReference ?? "",
      );

      return {
        presetId,
        sections: parseReferenceSections(fullReference),
      };
    })
    .sort((left, right) => left.presetId.localeCompare(right.presetId, "ja"));
}

function parseReferenceMarkdownEntries(): ReferenceEntry[] {
  const content = readFileSync(REFERENCE_MD_PATH, "utf8").replace(
    /^\uFEFF/,
    "",
  );
  const lines = content.split(/\r?\n/);
  const entries: ReferenceEntry[] = [];
  let currentEntry: ReferenceEntry | null = null;
  let currentSection: ReferenceSection | null = null;

  for (const line of lines) {
    if (line.startsWith("- ")) {
      currentEntry = {
        presetId: line.slice(2).trim(),
        sections: [],
      };
      currentSection = null;
      entries.push(currentEntry);
      continue;
    }

    if (line.startsWith("  - ")) {
      currentSection = {
        heading: normalizeReferenceLine(line.slice(4)),
        lines: [],
      };
      currentEntry?.sections.push(currentSection);
      continue;
    }

    if (line.startsWith("    - ")) {
      currentSection?.lines.push(normalizeReferenceLine(line.slice(6)));
    }
  }

  return entries;
}

describe("reference documentation", () => {
  it("reference.md は全 built-in preset の出典を presetId 単位で列挙する", () => {
    const documentedPresetIds = parseReferenceMarkdownEntries().map(
      (entry) => entry.presetId,
    );
    const presetIds = loadPresetReferenceEntries().map(
      (entry) => entry.presetId,
    );

    expect(documentedPresetIds).toEqual(presetIds);
  });

  it("reference.md は各 preset の出典区分と本文を反映する", () => {
    const documentedEntries = new Map(
      parseReferenceMarkdownEntries().map((entry) => [entry.presetId, entry]),
    );

    loadPresetReferenceEntries().forEach((expectedEntry) => {
      expect(documentedEntries.get(expectedEntry.presetId)?.sections).toEqual(
        expectedEntry.sections,
      );
    });
  });
});
