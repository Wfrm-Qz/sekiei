import { describe, expect, it, vi } from "vitest";
import { FontLoader } from "three/addons/loaders/FontLoader.js";

/**
 * text/fonts の font cache と fallback を確認する unit test。
 */
describe("text/fonts", () => {
  it("loadFaceTextFonts は正常系で fetch/parse して cache し、getFaceTextFont は fallback する", async () => {
    vi.resetModules();
    const module = await import("../../../src/text/fonts.ts");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ glyphs: {} }),
    } as never);
    const parseSpy = vi
      .spyOn(FontLoader.prototype, "parse")
      .mockReturnValue({ familyName: "mock-font" } as never);

    try {
      await module.loadFaceTextFonts();
      expect(fetchSpy).toHaveBeenCalledTimes(module.FACE_TEXT_FONTS.length);
      expect(parseSpy).toHaveBeenCalledTimes(module.FACE_TEXT_FONTS.length);
      expect(module.getFaceTextFont(module.FACE_TEXT_FONTS[0].id)).toEqual({
        familyName: "mock-font",
      });
      expect(module.getFaceTextFont("missing-font")).toEqual({
        familyName: "mock-font",
      });
    } finally {
      fetchSpy.mockRestore();
      parseSpy.mockRestore();
    }
  });

  it("loadFaceTextFonts は異常系で fetch failure を例外にする", async () => {
    vi.resetModules();
    const module = await import("../../../src/text/fonts.ts");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: vi.fn(),
    } as never);
    try {
      await expect(module.loadFaceTextFonts()).rejects.toThrow(
        "読み込みに失敗",
      );
    } finally {
      fetchSpy.mockRestore();
    }
  });
});
