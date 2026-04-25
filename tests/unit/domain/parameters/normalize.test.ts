import { describe, expect, it } from "vitest";
import {
  normalizeTwinParameters,
  readTwinParametersContent,
  validateTwinImportShape,
} from "../../../../src/domain/parameters/normalize.ts";

describe("domain/parameters/normalize", () => {
  it("正常系として schema v2 document を現行 runtime 形状へ正規化できる", () => {
    const normalized = normalizeTwinParameters({
      version: 2,
      schema: "sekiei-document",
      name: { jp: "test", en: "test" },
      crystalSystem: "cubic",
      axes: { a: 1, b: 1, c: 1 },
      angles: { alpha: 90, beta: 90, gamma: 90 },
      sizeMm: 50,
      crystals: [
        {
          id: "base",
          faces: [
            {
              id: "f1",
              h: 1,
              k: 0,
              l: 0,
              coefficient: 1,
              enabled: true,
              accentColor: "#3366cc",
            },
          ],
        },
        {
          id: "derived-1",
          from: "base",
          placement: {
            type: "penetration",
            rule: {
              kind: "axis",
              axis: { h: 1, k: 1, l: 1 },
              rotationAngleDeg: 60,
            },
          },
          faces: [
            { id: "f2", h: -1, k: 0, l: 0, coefficient: 1, enabled: true },
          ],
        },
      ],
    });

    expect(normalized.twin.enabled).toBe(true);
    expect(normalized.twin.crystals).toHaveLength(2);
    expect(normalized.twin.crystals[1].from).toBe(0);
    expect(normalized.twin.crystals[0].faces[0].accentColor).toBe("#3366cc");
  });

  it("異常系として不正 mode と過剰 crystal 数を reject する", () => {
    expect(() =>
      validateTwinImportShape({
        mode: "single",
        crystalSystem: "cubic",
      }),
    ).toThrow(/mode が不正/);

    expect(() =>
      readTwinParametersContent(
        JSON.stringify({
          version: 2,
          schema: "sekiei-document",
          crystalSystem: "cubic",
          crystals: Array.from({ length: 17 }, () => ({ faces: [] })),
        }),
      ),
    ).toThrow(/crystals が多すぎます/);
  });
});
