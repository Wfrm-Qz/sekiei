import { describe, expect, it } from "vitest";
import {
  getNextCoefficientValue,
  roundCoefficientValue,
} from "../../../src/ui/coefficientInput.ts";

/**
 * coefficientInput の係数スピン規則を確認する unit test。
 */
describe("ui/coefficientInput", () => {
  it("roundCoefficientValue は小数第 2 位へ丸める", () => {
    expect(roundCoefficientValue(1.234)).toBe(1.23);
  });

  it("getNextCoefficientValue は正常系で増加し、異常系の負値は 0 起点で扱う", () => {
    expect(getNextCoefficientValue(0.5, 1)).toBe(0.51);
    expect(getNextCoefficientValue(-2, 1)).toBe(0.01);
  });

  it("getNextCoefficientValue は減少時に 1 付近の段差を吸収する", () => {
    expect(getNextCoefficientValue(1, -1)).toBe(0.99);
    expect(getNextCoefficientValue(1.1, -1)).toBe(1);
    expect(getNextCoefficientValue(0.02, -1)).toBe(0.01);
  });
});
