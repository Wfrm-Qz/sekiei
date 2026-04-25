import { describe, expect, it } from "vitest";
import {
  getAvailableContactReferenceAxisLabels,
  normalizeContactReferenceAxisLabel,
  resolveContactReferenceAxisDirection,
} from "../../../src/domain/contactReferenceAxis.ts";

/**
 * 接触双晶の基準方向 UI と軸解決ロジックを確認する unit test。
 */
describe("domain/contactReferenceAxis", () => {
  it("四軸系では a3 / -a3 を含む候補を返す", () => {
    expect(getAvailableContactReferenceAxisLabels("trigonal")).toEqual(
      expect.arrayContaining(["a3", "-a3", "c", "-c"]),
    );
  });

  it("結晶系に存在しない基準方向ラベルは null へ正規化する", () => {
    expect(normalizeContactReferenceAxisLabel("a3", "cubic")).toBeNull();
    expect(normalizeContactReferenceAxisLabel("-a", "cubic")).toBe("-a");
  });

  it("軸ガイドの別名を吸収して方向ベクトルを返す", () => {
    const direction = resolveContactReferenceAxisDirection(
      [
        {
          label: "a1",
          start: { x: 0, y: 0, z: 0 },
          end: { x: 2, y: 0, z: 0 },
        },
        {
          label: "a2",
          start: { x: 0, y: 0, z: 0 },
          end: { x: 0, y: 3, z: 0 },
        },
      ],
      "-b",
    );

    expect(direction?.x).toBeCloseTo(0);
    expect(direction?.y).toBeCloseTo(-1);
    expect(direction?.z).toBeCloseTo(0);
  });
});
