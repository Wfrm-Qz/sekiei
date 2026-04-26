import { describe, expect, it, vi } from "vitest";
import { LEGACY_LOCALE_STORAGE_KEY } from "../../src/compat/legacyIdentifiers.ts";
import {
  applyTranslations,
  getCurrentLocale,
  initializeLocale,
  onLocaleChange,
  setCurrentLocale,
  setupLocaleSelect,
  t,
} from "../../src/i18n.ts";

/**
 * i18n module の現在言語、翻訳適用、select 連動を確認する unit test。
 */
describe("i18n", () => {
  it("setCurrentLocale は正常系で現在言語を更新し、異常系の未対応言語は無視する", () => {
    localStorage.setItem(LEGACY_LOCALE_STORAGE_KEY, "ja");
    setCurrentLocale("en");
    expect(getCurrentLocale()).toBe("en");
    expect(localStorage.getItem("sekiei.locale")).toBe("en");
    expect(localStorage.getItem(LEGACY_LOCALE_STORAGE_KEY)).toBeNull();

    setCurrentLocale("fr" as never);
    expect(getCurrentLocale()).toBe("en");
  });

  it("initializeLocale は html lang を現在言語へ同期する", () => {
    setCurrentLocale("en");
    initializeLocale();

    expect(document.documentElement.lang).toBe("en");
  });

  it("onLocaleChange は購読と解除ができる", () => {
    const listener = vi.fn();
    const dispose = onLocaleChange(listener);

    setCurrentLocale("en");
    expect(listener).toHaveBeenCalledWith("en");

    dispose();
    setCurrentLocale("ja");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("t は補間を解決し、未知キーはキー文字列を返す", () => {
    expect(t("crystals.indexed", { index: 3 }, "ja")).toBe("結晶3");
    expect(t("missing.translation.key", {}, "ja")).toBe(
      "missing.translation.key",
    );
  });

  it("applyTranslations は text / placeholder / aria-label / title を反映する", () => {
    document.body.innerHTML = `
      <div data-i18n="common.language"></div>
      <input data-i18n-placeholder="preset.placeholder" />
      <button data-i18n-aria-label="preset.clearInput"></button>
      <div data-i18n-title="common.actions"></div>
    `;

    applyTranslations(document, "en");

    expect(document.querySelector("[data-i18n]")).toHaveTextContent("Language");
    expect(document.querySelector("input")).toHaveAttribute(
      "placeholder",
      "Select preset",
    );
    expect(document.querySelector("button")).toHaveAttribute(
      "aria-label",
      "Clear preset input",
    );
    expect(document.querySelector("[data-i18n-title]")).toHaveAttribute(
      "title",
      "Actions",
    );
  });

  it("setupLocaleSelect は option を作り、変更時に現在言語を切り替える", () => {
    const select = document.createElement("select");

    setupLocaleSelect(select);
    expect(select.options).toHaveLength(2);
    expect(select.value).toBe("ja");

    select.value = "en";
    select.dispatchEvent(new Event("change"));

    expect(getCurrentLocale()).toBe("en");
    expect(select.options[0].textContent).toBe("Japanese");
  });
});
