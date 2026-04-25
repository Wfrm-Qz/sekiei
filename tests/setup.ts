import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { setCurrentLocale } from "../src/i18n.ts";

/**
 * jsdom ベースの unit / integration test 共通初期化。
 *
 * 言語設定と DOM を毎回初期状態へ戻し、テスト間で locale や localStorage が
 * にじまないようにする。
 */
beforeEach(() => {
  localStorage.clear();
  setCurrentLocale("ja");
  document.documentElement.lang = "ja";
});

afterEach(() => {
  document.body.innerHTML = "";
  localStorage.clear();
  setCurrentLocale("ja");
  vi.restoreAllMocks();
});
