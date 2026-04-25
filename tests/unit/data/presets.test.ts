import { describe, expect, it } from "vitest";
import { setCurrentLocale } from "../../../src/i18n.ts";
import {
  getPresetById,
  getSelectablePresets,
} from "../../../src/data/presets.ts";

/**
 * プリセット候補表示のローカライズと並び順を確認する unit test。
 *
 * `custom` 固定先頭や `[object Object]` 回避は実際に不具合が出た箇所なので、
 * 候補一覧レベルで期待値を固定しておく。
 */
describe("data/presets", () => {
  it("日本語では custom を先頭にしつつ現在言語名でソートする", () => {
    setCurrentLocale("ja");
    const presets = getSelectablePresets();
    const regularNames = presets.slice(1).map((preset) => preset.displayName);
    const sortedNames = [...regularNames].sort(new Intl.Collator("ja").compare);

    expect(presets[0].id).toBe("custom");
    expect(presets[0].label).not.toContain("[object Object]");
    expect(regularNames).toEqual(sortedNames);
    expect(
      presets.find((preset) => preset.id === "cube-00001")?.displayName,
    ).toBe("立方体");
  });

  it("英語では英語名を使って候補ラベルを組み立てる", () => {
    setCurrentLocale("en");
    const cubePreset = getSelectablePresets().find(
      (preset) => preset.id === "cube-00001",
    );

    expect(cubePreset?.displayName).toBe("cube");
    expect(cubePreset?.label).toBe("cube");
  });

  it("built-in preset は preview 付き wrapper JSON でも catalog へ載る", () => {
    const cubePreset = getPresetById("cube-00001");

    expect(cubePreset?.parameters?.schema).toBe("sekiei-document");
    expect(cubePreset?.preview?.faceDisplayMode).toBe("grouped");
    expect(cubePreset?.preview?.previewStyleSettings?.ridgeLines?.color).toBe(
      "#181818",
    );
  });
});
