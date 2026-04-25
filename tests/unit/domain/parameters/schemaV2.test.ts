import { describe, expect, it } from "vitest";
import { normalizeTwinParameters } from "../../../../src/domain/parameters.ts";
import { serializeTwinParameters } from "../../../../src/domain/parameters/schemaV2.ts";

describe("domain/parameters/schemaV2", () => {
  it("正常系として parameters を schema v2 document に変換できる", () => {
    const serialized = serializeTwinParameters(
      normalizeTwinParameters({
        crystalSystem: "cubic",
        faces: [
          {
            h: 1,
            k: 0,
            l: 0,
            coefficient: 1,
            text: {
              content: "A",
              fontId: "optimer",
              fontSize: 2,
              depth: 0.8,
              offsetU: 0.2,
              offsetV: -0.1,
              rotationDeg: 15,
            },
          },
        ],
        twin: {
          enabled: true,
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
                  accentColor: "#3366cc",
                  text: {
                    content: "A",
                    fontId: "optimer",
                    fontSize: 2,
                    depth: 0.8,
                    offsetU: 0.2,
                    offsetV: -0.1,
                    rotationDeg: 15,
                  },
                },
              ],
            },
            {
              id: "derived-1",
              from: 0,
              enabled: true,
              twinType: "penetration",
              ruleType: "axis",
              axis: { h: 1, k: 1, l: 1 },
              rotationAngleDeg: 60,
              faces: [{ id: "f2", h: -1, k: 0, l: 0, coefficient: 1 }],
              contact: {
                baseFaceRef: "f1",
                derivedFaceRef: "f2",
                referenceAxisLabel: null,
              },
            },
          ],
        },
      }),
    );

    expect(serialized.version).toBe(2);
    expect(serialized.schema).toBe("sekiei-document");
    expect(serialized.crystals).toHaveLength(2);
    expect(serialized.crystals[1].placement.rule.kind).toBe("axis");
    expect(serialized.crystals[0].faces[0].accentColor).toBe("#3366cc");
    expect(serialized.crystals[0].faces[0].text).toEqual({
      content: "A",
      fontId: "optimer",
      fontSize: 2,
      depth: 0.8,
      offsetU: 0.2,
      offsetV: -0.1,
      rotationDeg: 15,
    });
  });

  it("異常系寄りとして derived crystal がなくても base crystal 1 件を出力する", () => {
    const serialized = serializeTwinParameters(
      normalizeTwinParameters({
        crystalSystem: "cubic",
        faces: [{ h: 1, k: 0, l: 0, coefficient: 1 }],
      }),
    );

    expect(serialized.crystals).toHaveLength(1);
    expect(typeof serialized.crystals[0].id).toBe("string");
    expect(serialized.crystals[0].faces[0].text).toEqual({
      content: "",
      fontId: "helvetiker",
      fontSize: 5,
      depth: 1,
      offsetU: 0,
      offsetV: 0,
      rotationDeg: 0,
    });
  });
});
