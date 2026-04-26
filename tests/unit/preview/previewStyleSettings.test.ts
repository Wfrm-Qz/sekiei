import { describe, expect, it } from "vitest";
import { LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA } from "../../../src/compat/legacyIdentifiers.ts";
import {
  createDefaultTwinPreviewStyleSettings,
  createTwinPreviewSettingsDocument,
  isTwinPreviewSettingsDocument,
  normalizeTwinPreviewStyleSettings,
  resolveTwinPreviewResponsiveFontSizePx,
} from "../../../src/preview/previewStyleSettings.ts";

describe("preview/previewStyleSettings", () => {
  it("createDefaultTwinPreviewStyleSettings は desktop 基準の既定値を返す", () => {
    const settings = createDefaultTwinPreviewStyleSettings();

    expect(settings.faceLabel.fontSizePx).toBe(14);
    expect(settings.axisLabel.fontSizePx).toBe(48);
    expect(settings.twinRuleLabel.fontSizePx).toBe(24);
    expect(settings.presetMetadataName.fontSizePx).toBe(48);
    expect(settings.presetMetadataDescription.fontSizePx).toBe(24);
  });

  it("resolveTwinPreviewResponsiveFontSizePx は mobile で面指数以外を半分にする", () => {
    const originalMatchMedia = globalThis.matchMedia;
    globalThis.matchMedia = (() => ({
      matches: true,
      media: "(max-width: 760px)",
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    })) as typeof globalThis.matchMedia;

    try {
      expect(resolveTwinPreviewResponsiveFontSizePx(14, "faceLabel")).toBe(14);
      expect(resolveTwinPreviewResponsiveFontSizePx(48, "axisLabel")).toBe(24);
      expect(resolveTwinPreviewResponsiveFontSizePx(24, "twinRuleLabel")).toBe(
        12,
      );
      expect(
        resolveTwinPreviewResponsiveFontSizePx(48, "presetMetadataName"),
      ).toBe(24);
      expect(
        resolveTwinPreviewResponsiveFontSizePx(24, "presetMetadataDescription"),
      ).toBe(12);
    } finally {
      globalThis.matchMedia = originalMatchMedia;
    }
  });

  it("normalizeTwinPreviewStyleSettings は欠落項目を既定値で補う", () => {
    const normalized = normalizeTwinPreviewStyleSettings({
      ridgeLines: {
        color: "#445566",
      },
      customLineProfile: {
        showOccludedInteriorLines: true,
      },
    });

    expect(normalized.ridgeLines.color).toBe("#445566");
    expect(normalized.ridgeLines.width).toBe(2);
    expect(normalized.faceLabel.offset).toBe(0.05);
    expect(normalized.customLineProfile.showOccludedInteriorLines).toBe(true);
    expect(normalized.customLineProfile.hiddenSurfaceLineOpacityScale).toBe(
      0.5,
    );
  });

  it("createTwinPreviewSettingsDocument は preview 設定と mode をまとめる", () => {
    const document = createTwinPreviewSettingsDocument({
      parameters: { version: 2 },
      faceDisplayMode: "custom",
      previewStyleSettings: normalizeTwinPreviewStyleSettings({
        ridgeLines: {
          color: "#778899",
        },
      }),
    });

    expect(document.schema).toBe("sekiei-twin-preview-document-v1");
    expect(document.preview.faceDisplayMode).toBe("custom");
    expect(document.preview.previewStyleSettings.ridgeLines.color).toBe(
      "#778899",
    );
    expect(document.preview.previewStyleSettings.faceLabel.offset).toBe(0.05);
  });

  it("旧名 wrapper schema の document も import 互換として受け付ける", () => {
    expect(
      isTwinPreviewSettingsDocument({
        schema: LEGACY_TWIN_PREVIEW_SETTINGS_DOCUMENT_SCHEMA,
        parameters: { version: 2 },
        preview: {
          faceDisplayMode: "grouped",
          previewStyleSettings: {},
        },
      }),
    ).toBe(true);
  });
});
