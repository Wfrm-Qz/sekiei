import { describe, expect, it } from "vitest";
import {
  CRYSTAL_SYSTEMS,
  applyCrystalSystemConstraints,
  getCrystalSystemLabel,
  isFieldLocked,
  usesFourAxisMiller,
} from "../../../src/domain/crystalSystems.ts";

/**
 * 結晶系ごとの制約ルールを確認する unit test。
 *
 * UI の disable 制御、JSON 正規化、4 指数表示判定が同じ rule に依存するため、
 * 表示と制約の両方をここで固定する。
 */
describe("domain/crystalSystems", () => {
  it("結晶系ラベルは locale に応じた文字列を返す", () => {
    expect(getCrystalSystemLabel(CRYSTAL_SYSTEMS[0], "ja")).toBe("立方晶系");
  });

  it("label が不正でも id を fallback として返す", () => {
    expect(getCrystalSystemLabel({ id: "custom" }, "ja")).toBe("custom");
  });

  it("cubic の制約を適用すると b,c と角度が固定される", () => {
    const next = applyCrystalSystemConstraints({
      crystalSystem: "cubic",
      axes: { a: 2, b: 3, c: 4 },
      angles: { alpha: 10, beta: 20, gamma: 30 },
    });

    expect(next.axes).toEqual({ a: 2, b: 2, c: 2 });
    expect(next.angles).toEqual({ alpha: 90, beta: 90, gamma: 90 });
  });

  it("未知の結晶系は triclinic 扱いで値を固定しない", () => {
    const next = applyCrystalSystemConstraints({
      crystalSystem: "unknown",
      axes: { a: 2, b: 3, c: 4 },
      angles: { alpha: 10, beta: 20, gamma: 30 },
    });

    expect(next.axes).toEqual({ a: 2, b: 3, c: 4 });
    expect(next.angles).toEqual({ alpha: 10, beta: 20, gamma: 30 });
  });

  it("field lock 判定は axis と angle の両方を見分ける", () => {
    expect(isFieldLocked("hexagonal", "axis", "b")).toBe(true);
    expect(isFieldLocked("hexagonal", "angle", "gamma")).toBe(true);
  });

  it("triclinic では field lock が無い", () => {
    expect(isFieldLocked("triclinic", "axis", "b")).toBe(false);
    expect(isFieldLocked("triclinic", "angle", "gamma")).toBe(false);
  });

  it("六方・三方だけ 4 指数表示を使う", () => {
    expect(usesFourAxisMiller("hexagonal")).toBe(true);
    expect(usesFourAxisMiller("trigonal")).toBe(true);
  });

  it("それ以外の結晶系では 4 指数表示を使わない", () => {
    expect(usesFourAxisMiller("cubic")).toBe(false);
  });
});
