import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { readTwinParametersContent } from "../../../src/domain/parameters.ts";
import {
  isTwinPreviewSettingsDocument,
  normalizeTwinPreviewStyleSettings,
} from "../../../src/preview/previewStyleSettings.ts";

/**
 * 公開プリセット JSON と test fixture JSON が、現行 wrapper schema /
 * parameters schema に沿っていることを確認する。
 *
 * loader 経由の間接確認だけだと、個別ファイルの schema 崩れを見逃しやすいので、
 * tracked file を明示列挙して直接検証する。
 */

const PRESET_JSON_PATHS = readdirSync(
  resolve(process.cwd(), "src/data/presets"),
  {
    withFileTypes: true,
  },
)
  .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
  .map((entry) => `src/data/presets/${entry.name}`)
  .sort((left, right) => left.localeCompare(right, "ja"));

const PRESET_FILE_NAME_PATTERN =
  /^([a-z0-9]+(?:-[a-z0-9]+)*-\d{5})(?:-[A-Za-z0-9][A-Za-z0-9-]*)?\.json$/;

const BASIC_SHAPE_PRESET_IDS = new Set([
  "cube-00001",
  "hexagonal-prism-00001",
  "octahedron-00001",
]);

const SAMPLE_JSON_PATHS = [
  "docs/samples/cube.json",
  "docs/samples/cube-text.json",
  "docs/samples/hexagonal-prism-phase3.json",
  "docs/samples/twin-parameters.json",
];

const TEST_FIXTURE_JSON_PATHS = [
  "tests/fixtures/domain/twin-contact-cubic.json",
  "tests/fixtures/domain/twin-penetration-cubic.json",
];
const CURRENT_SCHEMA_JSON_PATHS = [
  ...PRESET_JSON_PATHS,
  ...SAMPLE_JSON_PATHS,
  ...TEST_FIXTURE_JSON_PATHS,
  "tests/fixtures/face-text/leftQuartz.withText.v2.json",
];

function loadJsonDocument(relativePath: string): unknown {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), relativePath), "utf8").replace(
      /^\uFEFF/,
      "",
    ),
  );
}

function expectValidWrapperDocument(relativePath: string) {
  const document = loadJsonDocument(relativePath);

  expect(
    isTwinPreviewSettingsDocument(document),
    `${relativePath} should be a wrapper schema document`,
  ).toBe(true);

  if (!isTwinPreviewSettingsDocument(document)) {
    return;
  }

  expect(document.parameters).toMatchObject({
    version: 2,
    schema: "sekiei-document",
  });
  expect(() =>
    readTwinParametersContent(JSON.stringify(document.parameters)),
  ).not.toThrow();
  expect(() =>
    normalizeTwinPreviewStyleSettings(document.preview.previewStyleSettings),
  ).not.toThrow();
}

describe("data/json schema documents", () => {
  it.each(PRESET_JSON_PATHS)(
    "built-in preset %s は安定IDと任意suffixの命名規則に一致する",
    (relativePath) => {
      const fileName = relativePath.split("/").at(-1) ?? "";
      const match = PRESET_FILE_NAME_PATTERN.exec(fileName);
      expect(
        match,
        `${relativePath} should be {slug}-{00001}[-suffix].json`,
      ).not.toBeNull();
      const document = loadJsonDocument(relativePath);

      if (!match || !isTwinPreviewSettingsDocument(document)) {
        return;
      }

      expect(document.parameters.presetId).toBe(match[1]);
    },
  );

  it.each(PRESET_JSON_PATHS)(
    "built-in preset %s は現行 wrapper schema に一致する",
    (relativePath) => {
      expectValidWrapperDocument(relativePath);
    },
  );

  it.each(PRESET_JSON_PATHS)(
    "built-in preset %s は非立方晶系・基本立体以外で Crystallography 出典を持つ",
    (relativePath) => {
      const document = loadJsonDocument(relativePath);

      if (!isTwinPreviewSettingsDocument(document)) {
        return;
      }

      const parameters = document.parameters;
      if (
        parameters.crystalSystem === "cubic" ||
        BASIC_SHAPE_PRESET_IDS.has(parameters.presetId)
      ) {
        return;
      }

      expect(
        String(parameters.metadata?.fullReference ?? ""),
        `${relativePath} should include a Crystallography source in metadata.fullReference`,
      ).toMatch(/\bCrystallography\b/);
    },
  );

  it.each(SAMPLE_JSON_PATHS)(
    "docs sample %s は現行 wrapper schema に一致する",
    (relativePath) => {
      expectValidWrapperDocument(relativePath);
    },
  );

  it.each(TEST_FIXTURE_JSON_PATHS)(
    "test fixture %s は現行 wrapper schema に一致する",
    (relativePath) => {
      expectValidWrapperDocument(relativePath);
    },
  );

  it.each(CURRENT_SCHEMA_JSON_PATHS)(
    "current schema JSON %s は face distance を使い coefficient を含めない",
    (relativePath) => {
      const raw = readFileSync(resolve(process.cwd(), relativePath), "utf8");

      expect(raw).toContain('"distance"');
      expect(raw).not.toContain('"coefficient"');
    },
  );
});
