import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  colorToRgbaString,
  createCrystalUiColors,
  createFaceGroupColor,
  getCrystalAccentColor,
  hashFaceGroupKey,
  normalizeCrystalAccentColor,
  normalizeModuloTen,
  parseFaceGroupKeyValues,
} from "../../../src/state/colorHelpers.ts";

/**
 * state/colorHelpers の色生成規則と安定 hash を確認する unit test。
 */
describe("state/colorHelpers", () => {
  it("colorToRgbaString は正常系で rgba 文字列へ変換する", () => {
    const color = new THREE.Color(1, 0.5, 0);
    expect(colorToRgbaString(color, 0.25)).toBe("rgba(255, 128, 0, 0.25)");
  });

  it("hashFaceGroupKey は同じ key で安定し、異なる key では通常変わる", () => {
    expect(hashFaceGroupKey("a|b|c")).toBe(hashFaceGroupKey("a|b|c"));
    expect(hashFaceGroupKey("a|b|c")).not.toBe(hashFaceGroupKey("x|y|z"));
  });

  it("parseFaceGroupKeyValues は数値だけを抜き出し、normalizeModuloTen は負値を丸める", () => {
    expect(parseFaceGroupKeyValues("1|2|x::-3|4")).toEqual([1, 2, -3, 4]);
    expect(normalizeModuloTen(-1)).toBe(-1);
    expect(normalizeModuloTen(-0)).toBe(0);
  });

  it("createFaceGroupColor は正常系で preview/background/border を返し、同じ key なら安定する", () => {
    const left = createFaceGroupColor("cubic:1|0|0");
    const right = createFaceGroupColor("cubic:1|0|0");

    expect(left.preview).toMatch(/^#/);
    expect(left.background).toContain("rgba(");
    expect(left.border).toContain("rgba(");
    expect(left).toEqual(right);
  });

  it("getCrystalAccentColor は index を巡回し、custom 色があればそちらを優先する", () => {
    expect(getCrystalAccentColor(0)).toBe(getCrystalAccentColor(6));
    expect(getCrystalAccentColor(1, "#112233")).toBe("#112233");
    expect(normalizeCrystalAccentColor("#aabbcc")).toBe("#aabbcc");
    expect(normalizeCrystalAccentColor("bad")).toBeNull();

    const colors = createCrystalUiColors(1, "#112233");
    expect(colors.tabBackground).toContain("rgba(");
    expect(colors.tableHeadBackground).toContain("rgba(");
  });
});
