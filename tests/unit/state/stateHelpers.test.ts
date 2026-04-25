import { describe, expect, it } from "vitest";
import {
  buildFaceGroupStateKey,
  clampActiveCrystalIndex,
  createCrystalId,
  formatCrystalTabLabel,
  formatCrystalUiLabel,
  getGuideCrystalIndex,
  getTwinCrystal,
  getTwinCrystalFaces,
  getTwinCrystals,
  isFaceEnabled,
  isTwinEnabled,
  setTwinCrystalFaces,
  twinRuleTypeForTwinType,
} from "../../../src/state/stateHelpers.ts";

/**
 * state/stateHelpers の access helper と clamp / 判定処理を確認する unit test。
 */
describe("state/stateHelpers", () => {
  const parameters = {
    faces: [{ id: "base-face" }],
    twin: {
      enabled: true,
      crystals: [
        { id: "base", enabled: true, faces: [{ id: "f1" }] },
        { id: "derived-1", enabled: false, faces: [{ id: "f2" }], from: 0 },
        { id: "derived-2", enabled: true, faces: [{ id: "f3" }], from: 0 },
      ],
    },
  };

  it("formatCrystalUiLabel は基準結晶と派生結晶で文言を分ける", () => {
    const translate = (key, params = {}) =>
      key === "crystals.first"
        ? "結晶1"
        : key === "crystals.firstShort"
          ? "C1"
          : key === "crystals.indexedShort"
            ? `C${params.index}`
            : `結晶${params.index}`;

    expect(formatCrystalUiLabel(0, translate)).toBe("結晶1");
    expect(formatCrystalUiLabel(2, translate)).toBe("結晶3");
    expect(formatCrystalTabLabel(0, translate)).toBe("C1");
    expect(formatCrystalTabLabel(2, translate)).toBe("C3");
  });

  it("getTwinCrystalFaces / getTwinCrystals / getTwinCrystal は正常系と欠損時の fallback を返す", () => {
    expect(getTwinCrystalFaces(parameters, 0)).toEqual([{ id: "f1" }]);
    expect(getTwinCrystalFaces({}, 0)).toEqual([]);
    expect(getTwinCrystals(parameters)).toHaveLength(3);
    expect(getTwinCrystals({})).toEqual([]);
    expect(getTwinCrystal(parameters, 2)?.id).toBe("derived-2");
    expect(getTwinCrystal(parameters, 99)).toBeNull();
  });

  it("isTwinEnabled と twinRuleTypeForTwinType は状態と twinType を解釈する", () => {
    expect(isTwinEnabled(parameters)).toBe(true);
    expect(isTwinEnabled({})).toBe(false);
    expect(twinRuleTypeForTwinType("contact")).toBe("plane");
    expect(twinRuleTypeForTwinType("penetration")).toBe("axis");
  });

  it("setTwinCrystalFaces は対象結晶と基準 faces を更新し、active index は範囲へ clamp する", () => {
    const next = structuredClone(parameters);
    setTwinCrystalFaces(next, 0, [{ id: "new-base" }]);

    expect(next.twin.crystals[0].faces).toEqual([{ id: "new-base" }]);
    expect(next.faces).toEqual([{ id: "new-base" }]);
    expect(clampActiveCrystalIndex(next, 10)).toBe(2);
    expect(clampActiveCrystalIndex(next, -2)).toBe(0);
  });

  it("getGuideCrystalIndex は有効派生結晶へ fallback し、group key と crystal id を作る", () => {
    expect(getGuideCrystalIndex(parameters, 1)).toBe(2);
    expect(buildFaceGroupStateKey(2, "1|0|0", "::")).toBe("2::1|0|0");
    const crystalId = createCrystalId();

    expect(typeof crystalId).toBe("string");
    expect(crystalId.length).toBeGreaterThan(0);
  });

  it("isFaceEnabled は disabled face と draft face を除外する", () => {
    expect(isFaceEnabled({ enabled: true })).toBe(true);
    expect(isFaceEnabled({ enabled: false })).toBe(false);
    expect(isFaceEnabled({ draftEmptyFields: ["h"] })).toBe(false);
  });
});
