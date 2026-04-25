import { describe, expect, it } from "vitest";
import {
  normalizeParameters,
  readParametersContent,
  readParametersFile,
  serializeParameters,
} from "../../../src/io/parameters.ts";

/**
 * 単結晶 JSON の互換読み込みと保存スキーマを確認する unit test。
 *
 * `name` の旧形式文字列互換は単結晶・双晶の両方の基礎になるため、
 * ここで明示的に固定しておく。
 */
describe("io/parameters", () => {
  it("旧形式の文字列 name を { en, jp } へ正規化する", () => {
    const normalized = normalizeParameters({
      name: "Legacy Cube",
      crystalSystem: "cubic",
    });

    expect(normalized.name).toEqual({
      en: "Legacy Cube",
      jp: "Legacy Cube",
    });
  });

  it("serializeParameters は name を常に多言語オブジェクトで出力する", () => {
    const serialized = serializeParameters(
      normalizeParameters({
        name: { en: "Cube", jp: "立方体" },
        crystalSystem: "cubic",
      }),
    );

    expect(serialized.name).toEqual({
      en: "Cube",
      jp: "立方体",
    });
  });

  it("不正な root 型の JSON を拒否する", () => {
    expect(() => readParametersContent("[]")).toThrow(/JSON のルートは object/);
  });

  it("不正な JSON 文字列を例外として扱う", () => {
    expect(() => readParametersContent("{")).toThrow();
  });

  it("面数上限を超える JSON を拒否する", () => {
    const payload = {
      crystalSystem: "cubic",
      faces: Array.from({ length: 257 }, () => ({
        h: 1,
        k: 0,
        l: 0,
        coefficient: 1,
      })),
    };

    expect(() => readParametersContent(JSON.stringify(payload))).toThrow(
      /faces が多すぎます/,
    );
  });

  it("範囲外の数値を拒否する", () => {
    expect(() =>
      readParametersContent(
        JSON.stringify({
          crystalSystem: "cubic",
          sizeMm: 1001,
        }),
      ),
    ).toThrow(/sizeMm は 1000 以下/);
  });

  it("不明フィールドが混在していても既知フィールドだけで正規化する", () => {
    const normalized = readParametersContent(
      JSON.stringify({
        crystalSystem: "cubic",
        unknownField: "<script>",
        faces: [{ h: 1, k: 0, l: 0, coefficient: 1, strange: true }],
      }),
    );

    expect(normalized.crystalSystem).toBe("cubic");
    expect(normalized.faces).toHaveLength(1);
  });

  it("ファイルサイズ上限を超える JSON ファイルを拒否する", async () => {
    const file = new File(["x".repeat(1_000_001)], "huge.json", {
      type: "application/json",
    });

    await expect(readParametersFile(file)).rejects.toThrow(
      /JSON ファイルが大きすぎます/,
    );
  });
});
