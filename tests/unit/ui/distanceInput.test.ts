import { describe, expect, it } from "vitest";
import {
  getNextDistanceValue,
  roundDistanceValue,
} from "../../../src/ui/distanceInput.ts";

/**
 * distanceInput の距離スピン規則を確認する unit test。
 */
describe("ui/distanceInput", () => {
  it("roundDistanceValue は小数第 2 位へ丸める", () => {
    expect(roundDistanceValue(1.234)).toBe(1.23);
  });

  it("getNextDistanceValue は負値も距離として扱って増減する", () => {
    expect(getNextDistanceValue(0.5, 1)).toBe(0.51);
    expect(getNextDistanceValue(-2, 1)).toBe(-1.99);
  });

  it("getNextDistanceValue は減少時に 1 付近の段差を吸収する", () => {
    expect(getNextDistanceValue(1, -1)).toBe(0.99);
    expect(getNextDistanceValue(1.1, -1)).toBe(1);
    expect(getNextDistanceValue(0.02, -1)).toBe(0.01);
  });
});
