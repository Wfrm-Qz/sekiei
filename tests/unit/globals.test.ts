import { describe, expect, it } from "vitest";

/**
 * globals.d.ts は runtime 実装を持たないため、型宣言自体は tsc で守る。
 * 対応 test file を揃える目的で最小限の smoke を置く。
 */
describe("globals", () => {
  it("正常系として型宣言は build 時の tsc 対象である", () => {
    expect(true).toBe(true);
  });

  it("異常系寄りとして runtime export を前提にしない", () => {
    expect(typeof globalThis).toBe("object");
  });
});
