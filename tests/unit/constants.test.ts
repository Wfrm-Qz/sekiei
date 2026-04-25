import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALIZED_NAME,
  createDefaultParameters,
  getLocalizedNameText,
  normalizeLocalizedName,
} from "../../src/constants.ts";

/**
 * `constants.ts` façade に残した共通 helper を確認する unit test。
 *
 * 内部実装を `domain/*` へ分離しても、既存 import 互換と既定値の意味が変わらないことを守る。
 */
describe("constants", () => {
  it("文字列の name を en/jp 共通の localized name に正規化する", () => {
    expect(normalizeLocalizedName("Corundum")).toEqual({
      en: "Corundum",
      jp: "Corundum",
    });
  });

  it("空や未知値の name は fallback を使って正規化する", () => {
    expect(normalizeLocalizedName(null, DEFAULT_LOCALIZED_NAME)).toEqual(
      DEFAULT_LOCALIZED_NAME,
    );
  });

  it("希望言語が空でも反対言語へ fallback して名称を返す", () => {
    expect(
      getLocalizedNameText(
        { en: "Quartz", jp: "" },
        "jp",
        DEFAULT_LOCALIZED_NAME,
      ),
    ).toBe("Quartz");
  });

  it("既定パラメーター生成では cubic の初期 faces と 50mm を持つ", () => {
    const parameters = createDefaultParameters();

    expect(parameters.crystalSystem).toBe("cubic");
    expect(parameters.sizeMm).toBe(50);
    expect(parameters.faces).toHaveLength(6);
    expect(parameters.name).toEqual(DEFAULT_LOCALIZED_NAME);
  });
});
