import { describe, expect, it } from "vitest";
import {
  normalizeTwinParameters,
  readTwinParametersContent,
  readTwinParametersFile,
  serializeTwinParameters,
} from "../../../src/domain/parameters.ts";

/**
 * 双晶 JSON 正規化の互換責務を確認する unit test。
 *
 * `twin.crystals` の保持、face ref の id 化、基準方向の正規化は
 * 接触双晶・プリセット読み込みの回帰点なので優先的に固定する。
 */
describe("domain/parameters", () => {
  it("旧形式 name を保持しつつ twin.crystals と contact face ref を正規化する", () => {
    const normalized = normalizeTwinParameters({
      mode: "twin",
      name: "Legacy Twin",
      crystalSystem: "cubic",
      faces: [
        { h: 1, k: 0, l: 0, coefficient: 1 },
        { h: -1, k: 0, l: 0, coefficient: 1 },
        { h: 0, k: 1, l: 0, coefficient: 1 },
        { h: 0, k: -1, l: 0, coefficient: 1 },
      ],
      twin: {
        enabled: true,
        crystals: [
          {
            faces: [
              { h: 1, k: 0, l: 0, coefficient: 1 },
              { h: -1, k: 0, l: 0, coefficient: 1 },
              { h: 0, k: 1, l: 0, coefficient: 1 },
              { h: 0, k: -1, l: 0, coefficient: 1 },
            ],
          },
          {
            from: 0,
            twinType: "contact",
            contact: {
              baseFaceRef: 1,
              derivedFaceRef: 0,
              referenceAxisLabel: "a3",
            },
            faces: [
              { h: 1, k: 0, l: 0, coefficient: 1 },
              { h: -1, k: 0, l: 0, coefficient: 1 },
              { h: 0, k: 1, l: 0, coefficient: 1 },
              { h: 0, k: -1, l: 0, coefficient: 1 },
            ],
          },
        ],
      },
    });

    expect(normalized.name).toEqual({
      en: "Legacy Twin",
      jp: "Legacy Twin",
    });
    expect(normalized.twin.crystals).toHaveLength(2);
    expect(normalized.twin.crystals[1].twinType).toBe("contact");
    expect(normalized.twin.crystals[1].contact.baseFaceRef).toBe(
      normalized.twin.crystals[0].faces[1].id,
    );
    expect(normalized.twin.crystals[1].contact.derivedFaceRef).toBe(
      normalized.twin.crystals[1].faces[0].id,
    );
    expect(normalized.twin.crystals[1].contact.referenceAxisLabel).toBeNull();
  });

  it("結晶数上限を超える twin.crystals を拒否する", () => {
    expect(() =>
      readTwinParametersContent(
        JSON.stringify({
          mode: "twin",
          crystalSystem: "cubic",
          twin: {
            enabled: true,
            crystals: Array.from({ length: 17 }, () => ({ faces: [] })),
          },
        }),
      ),
    ).toThrow(/twin\.crystals が多すぎます/);
  });

  it("不正な twinType を拒否する", () => {
    expect(() =>
      readTwinParametersContent(
        JSON.stringify({
          mode: "twin",
          crystalSystem: "cubic",
          twin: {
            enabled: true,
            crystals: [{ faces: [] }, { twinType: "invalid", faces: [] }],
          },
        }),
      ),
    ).toThrow(/twin\.crystals\[1\]\.twinType が不正/);
  });

  it("mode が twin 以外の JSON を拒否する", () => {
    expect(() =>
      readTwinParametersContent(
        JSON.stringify({
          mode: "single",
          crystalSystem: "cubic",
          twin: {
            enabled: true,
          },
        }),
      ),
    ).toThrow(/mode が不正/);
  });

  it("ファイルサイズ上限を超える双晶 JSON を拒否する", async () => {
    const file = new File(["x".repeat(1_000_001)], "huge-twin.json", {
      type: "application/json",
    });

    await expect(readTwinParametersFile(file)).rejects.toThrow(
      /JSON ファイルが大きすぎます/,
    );
  });

  it("新形式 schema v2 の crystals 配列と metadata を正規化できる", () => {
    const normalized = readTwinParametersContent(
      JSON.stringify({
        version: 2,
        schema: "sekiei-document",
        name: {
          jp: "新形式双晶",
          en: "New Twin",
        },
        metadata: {
          shortDescription: "short",
          description: "desc",
          reference: "ref",
          fullReference: "full",
        },
        crystalSystem: "cubic",
        axes: { a: 1, b: 1, c: 1 },
        angles: { alpha: 90, beta: 90, gamma: 90 },
        sizeMm: 50,
        crystals: [
          {
            id: "base",
            enabled: true,
            faces: [
              {
                id: "f1",
                h: 1,
                k: 0,
                l: 0,
                coefficient: 1,
                enabled: true,
                text: {
                  content: "A",
                  fontId: "optimer",
                  fontSize: 2,
                  depth: 0.75,
                  offsetU: 0.1,
                  offsetV: -0.2,
                  rotationDeg: 30,
                },
              },
            ],
          },
          {
            id: "derived-1",
            enabled: true,
            from: "base",
            placement: {
              type: "contact",
              rule: {
                kind: "plane",
                plane: { h: 1, k: 1, l: 1 },
              },
            },
            contact: {
              baseFaceRef: "f1",
              derivedFaceRef: 0,
              referenceAxisLabel: "a3",
            },
            faces: [
              { id: "f2", h: -1, k: 0, l: 0, coefficient: 1, enabled: true },
            ],
          },
        ],
      }),
    );

    expect(normalized.shortDescription).toBe("short");
    expect(normalized.description).toBe("desc");
    expect(normalized.reference).toBe("ref");
    expect(normalized.fullReference).toBe("full");
    expect(normalized.twin.enabled).toBe(true);
    expect(normalized.twin.crystals).toHaveLength(2);
    expect(normalized.twin.crystals[1].from).toBe(0);
    expect(normalized.twin.crystals[1].twinType).toBe("contact");
    expect(normalized.twin.crystals[1].contact.baseFaceRef).toBe("f1");
    expect(normalized.twin.crystals[1].contact.referenceAxisLabel).toBeNull();
    expect(normalized.twin.crystals[0].faces[0].text).toMatchObject({
      content: "A",
      fontId: "optimer",
      fontSize: 2,
      depth: 0.75,
      offsetU: 0.1,
      offsetV: -0.2,
      rotationDeg: 30,
    });
  });

  it("双晶保存 JSON は schema v2 と crystals 配列で出力する", () => {
    const serialized = serializeTwinParameters(
      normalizeTwinParameters({
        crystalSystem: "cubic",
        faces: [
          { h: 1, k: 0, l: 0, coefficient: 1 },
          { h: -1, k: 0, l: 0, coefficient: 1 },
        ],
        twin: {
          enabled: true,
          crystals: [
            {
              id: "base",
              faces: [
                { id: "f1", h: 1, k: 0, l: 0, coefficient: 1, enabled: true },
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
              faces: [
                {
                  id: "f2",
                  h: -1,
                  k: 0,
                  l: 0,
                  coefficient: 1,
                  enabled: true,
                  text: {
                    content: "Twin",
                    fontId: "gentilis",
                    fontSize: 1.9,
                    depth: 0.6,
                    offsetU: 0.25,
                    offsetV: -0.15,
                    rotationDeg: 20,
                  },
                },
              ],
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
    expect(serialized).not.toHaveProperty("faces");
    expect(serialized).not.toHaveProperty("twin");
    expect(serialized.crystals).toHaveLength(2);
    expect(serialized.crystals[0].faces[0].id).toBe("f1");
    expect(serialized.crystals[1].from).toBe("base");
    expect(serialized.crystals[1].placement.type).toBe("penetration");
    expect(serialized.crystals[1].placement.rule.kind).toBe("axis");
    expect(serialized.crystals[1].faces[0].text).toEqual({
      content: "Twin",
      fontId: "gentilis",
      fontSize: 1.9,
      depth: 0.6,
      offsetU: 0.25,
      offsetV: -0.15,
      rotationDeg: 20,
    });
  });

  it("双晶 schema v2 は複数結晶の face text を save/load round-trip で保持する", () => {
    const source = normalizeTwinParameters({
      crystalSystem: "cubic",
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
                text: {
                  content: "B",
                  fontId: "helvetiker",
                  fontSize: 5,
                  depth: 1,
                  offsetU: 0,
                  offsetV: 0,
                  rotationDeg: 0,
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
            faces: [
              {
                id: "f2",
                h: -1,
                k: 0,
                l: 0,
                coefficient: 1,
                text: {
                  content: "D",
                  fontId: "optimer",
                  fontSize: 4,
                  depth: 0.8,
                  offsetU: 0.2,
                  offsetV: -0.1,
                  rotationDeg: 15,
                },
              },
            ],
          },
        ],
      },
    });

    const roundTripped = readTwinParametersContent(
      JSON.stringify(serializeTwinParameters(source)),
    );

    expect(roundTripped.twin.crystals[0].faces[0].text).toMatchObject({
      content: "B",
      fontId: "helvetiker",
      fontSize: 5,
    });
    expect(roundTripped.twin.crystals[1].faces[0].text).toMatchObject({
      content: "D",
      fontId: "optimer",
      fontSize: 4,
      depth: 0.8,
      offsetU: 0.2,
      offsetV: -0.1,
      rotationDeg: 15,
    });
  });

  it("双晶 schema v2 は crystal / face の accentColor を crystals 側で save/load round-trip する", () => {
    const source = normalizeTwinParameters({
      crystalSystem: "cubic",
      twin: {
        enabled: true,
        crystals: [
          {
            id: "base",
            accentColor: "#2255aa",
            faces: [
              {
                id: "f1",
                h: 1,
                k: 0,
                l: 0,
                coefficient: 1,
                accentColor: "#3366cc",
              },
            ],
          },
          {
            id: "derived-1",
            from: 0,
            accentColor: "#aa5522",
            enabled: true,
            twinType: "penetration",
            ruleType: "axis",
            axis: { h: 1, k: 1, l: 1 },
            rotationAngleDeg: 60,
            faces: [
              {
                id: "f2",
                h: -1,
                k: 0,
                l: 0,
                coefficient: 1,
                accentColor: "#cc6633",
              },
            ],
          },
        ],
      },
    });

    const serialized = serializeTwinParameters(source);

    expect(serialized.crystals[0].accentColor).toBe("#2255aa");
    expect(serialized.crystals[0].faces[0].accentColor).toBe("#3366cc");
    expect(serialized.crystals[1].accentColor).toBe("#aa5522");
    expect(serialized.crystals[1].faces[0].accentColor).toBe("#cc6633");

    const roundTripped = readTwinParametersContent(JSON.stringify(serialized));

    expect(roundTripped.twin.crystals[0].accentColor).toBe("#2255aa");
    expect(roundTripped.twin.crystals[0].faces[0].accentColor).toBe("#3366cc");
    expect(roundTripped.twin.crystals[1].accentColor).toBe("#aa5522");
    expect(roundTripped.twin.crystals[1].faces[0].accentColor).toBe("#cc6633");
  });

  it("双晶 schema v2 は STL 分割設定を保存対象に含めない", () => {
    const source = normalizeTwinParameters({
      crystalSystem: "cubic",
      twin: {
        crystals: [
          {
            id: "base",
            faces: [{ id: "f1", h: 1, k: 0, l: 0, coefficient: 1 }],
          },
        ],
      },
    });

    const serialized = serializeTwinParameters(source);
    expect(serialized).not.toHaveProperty("stlSplit");

    const roundTripped = readTwinParametersContent(JSON.stringify(serialized));
    expect(roundTripped).not.toHaveProperty("stlSplit");
  });

  it("旧 coefficient 0 の双晶 face は distance 100 の無効面として正規化する", () => {
    const normalized = normalizeTwinParameters({
      crystalSystem: "cubic",
      twin: {
        crystals: [
          {
            id: "base",
            faces: [
              {
                id: "f1",
                h: 1,
                k: 0,
                l: 0,
                coefficient: 0,
                enabled: true,
              },
            ],
          },
        ],
      },
    });

    expect(normalized.twin.crystals[0].faces[0]).toMatchObject({
      id: "f1",
      distance: 100,
      enabled: false,
    });
  });
});
