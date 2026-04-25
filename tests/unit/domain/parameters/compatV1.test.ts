import { describe, expect, it } from "vitest";
import { LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMA } from "../../../../src/compat/legacyIdentifiers.ts";
import {
  convertTwinDocumentV2ToLegacyShape,
  isTwinDocumentV2,
  validateTwinImportShape,
} from "../../../../src/domain/parameters/compatV1.ts";

describe("domain/parameters/compatV1", () => {
  it("v2 schema document を旧互換 shape に変換できる", () => {
    const legacy = convertTwinDocumentV2ToLegacyShape({
      version: 2,
      schema: "sekiei-document",
      crystalSystem: "cubic",
      metadata: {
        shortDescription: "short",
      },
      crystals: [
        { id: "base", faces: [{ h: 1, k: 0, l: 0, coefficient: 1 }] },
        {
          id: "derived",
          from: "base",
          placement: {
            type: "contact",
            rule: { kind: "plane", plane: { h: 1, k: 1, l: 1 } },
          },
          faces: [{ h: -1, k: 0, l: 0, coefficient: 1 }],
        },
      ],
    });

    expect(legacy.mode).toBe("twin");
    expect(legacy.shortDescription).toBe("short");
    expect(legacy.twin.enabled).toBe(true);
    expect(legacy.twin.crystals[1].from).toBe(0);
    expect(legacy.twin.crystals[1].twinType).toBe("contact");
  });

  it("v2 schema 判定は crystals を持つ document だけ true にする", () => {
    expect(
      isTwinDocumentV2({
        version: 2,
        schema: "sekiei-document",
        crystals: [],
      }),
    ).toBe(true);
    expect(isTwinDocumentV2({ version: 2, schema: "other" })).toBe(false);
  });

  it("旧名 schema の v2 document も import 互換として受け付ける", () => {
    expect(
      isTwinDocumentV2({
        version: 2,
        schema: LEGACY_TWIN_PARAMETERS_DOCUMENT_SCHEMA,
        crystals: [],
      }),
    ).toBe(true);
  });

  it("不正な placement.type を reject する", () => {
    expect(() =>
      validateTwinImportShape({
        version: 2,
        schema: "sekiei-document",
        crystalSystem: "cubic",
        crystals: [
          { faces: [] },
          {
            placement: {
              type: "invalid",
            },
            faces: [],
          },
        ],
      }),
    ).toThrow(/placement\.type が不正/);
  });

  it("legacy twin block は twin が無くても reject しない", () => {
    expect(() =>
      validateTwinImportShape({
        crystalSystem: "cubic",
        faces: [],
      }),
    ).not.toThrow();
  });
});
