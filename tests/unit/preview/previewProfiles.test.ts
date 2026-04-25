import { describe, expect, it } from "vitest";
import {
  createDefaultEditableTwinPreviewFaceProfile,
  createDefaultEditableTwinPreviewLineProfile,
  resolveTwinPreviewFaceProfile,
  resolveTwinPreviewLineProfile,
} from "../../../src/preview/previewProfiles.ts";

/**
 * previewProfiles の mode -> profile 解決を固定する unit test。
 */
describe("preview/previewProfiles", () => {
  it("transparent は layered / depth mask あり、内部稜線小片も front 同色で出す", () => {
    const profile = resolveTwinPreviewLineProfile("transparent");

    expect(profile.useLayeredLines).toBe(true);
    expect(profile.useDepthMask).toBe(true);
    expect(profile.showHiddenSurfaceLines).toBe(true);
    expect(profile.showOccludedInteriorLines).toBe(true);
    expect(profile.hiddenSurfaceLineColorMode).toBe("same-as-front");
    expect(profile.hiddenSurfaceLineCustomColor).toBe("#7a7a7a");
    expect(profile.occludedInteriorLineColorMode).toBe("same-as-front");
    expect(profile.occludedInteriorLineCustomColor).toBe("#7a7a7a");
    expect(profile.occludedInteriorLineOpacityScale).toBe(
      profile.hiddenSurfaceLineOpacityScale,
    );
    expect(profile.occludedInteriorLineWidthScale).toBe(
      profile.hiddenSurfaceLineWidthScale,
    );
    expect(profile.depthMaskOffsetFactor).toBe(0.25);
    expect(profile.depthMaskOffsetUnits).toBe(0.5);
  });

  it("xray-solid は layered / overlay ありで内部稜線小片も出す", () => {
    const profile = resolveTwinPreviewLineProfile("xray-solid");

    expect(profile.useLayeredLines).toBe(true);
    expect(profile.useScreenSpaceLineOverlay).toBe(true);
    expect(profile.showHiddenSurfaceLines).toBe(true);
    expect(profile.showOccludedInteriorLines).toBe(true);
    expect(profile.hiddenSurfaceLineColorMode).toBe("tinted");
    expect(profile.hiddenSurfaceLineCustomColor).toBe("#7a7a7a");
    expect(profile.occludedInteriorLineColorMode).toBe("tinted");
    expect(profile.occludedInteriorLineCustomColor).toBe("#9a9a9a");
    expect(profile.occludedInteriorLineOpacityScale).toBeLessThan(
      profile.hiddenSurfaceLineOpacityScale,
    );
    expect(profile.occludedInteriorLineWidthScale).toBeLessThan(
      profile.hiddenSurfaceLineWidthScale,
    );
    expect(profile.depthMaskOffsetFactor).toBe(1);
    expect(profile.depthMaskOffsetUnits).toBe(2);
  });

  it("grouped は現段階では hidden 系を出さない", () => {
    const profile = resolveTwinPreviewLineProfile("grouped");

    expect(profile.useLayeredLines).toBe(false);
    expect(profile.showHiddenSurfaceLines).toBe(false);
    expect(profile.showOccludedInteriorLines).toBe(false);
  });

  it("custom の既定 line profile は hidden opacity を 0.5 で始める", () => {
    const profile = createDefaultEditableTwinPreviewLineProfile();

    expect(profile.hiddenSurfaceLineOpacityScale).toBe(0.5);
    expect(profile.occludedInteriorLineOpacityScale).toBe(0.5);
  });

  it("face profile は xray-grouped で screen-space face overlay を使う", () => {
    const profile = resolveTwinPreviewFaceProfile("xray-grouped");

    expect(profile.surfaceStyle).toBe("xray-grouped");
    expect(profile.usesScreenSpaceFaceOverlay).toBe(true);
    expect(profile.usesLighting).toBe(false);
    expect(profile.materialKind).toBe("basic");
    expect(profile.baseColorMode).toBe("crystal-accent");
    expect(profile.opacityWhenHasFinal).toBe(0.28);
    expect(profile.opacityWhenNoFinal).toBe(0.45);
    expect(profile.depthWrite).toBe(false);
    expect(profile.componentBuildMode).toBe("grouped-face-group");
    expect(profile.preferFinalMergedGeometry).toBe(false);
    expect(profile.usesFaceGroupPalette).toBe(true);
    expect(profile.groupedFaceComponentOpacity).toBe(0.58);
  });

  it("face profile は opaque 系と transparent 系で材質属性を切り替える", () => {
    const solid = resolveTwinPreviewFaceProfile("solid");
    const transparent = resolveTwinPreviewFaceProfile("transparent");

    expect(solid.materialKind).toBe("physical");
    expect(solid.baseColorMode).toBe("crystal-accent");
    expect(solid.opacityWhenHasFinal).toBe(1);
    expect(solid.usePolygonOffset).toBe(true);
    expect(solid.componentBuildMode).toBe("display-geometry-mesh");
    expect(solid.allowSharedSolidFaceColorMap).toBe(true);
    expect(solid.allowSharedSolidFaceOverlay).toBe(true);

    expect(transparent.materialKind).toBe("basic");
    expect(transparent.baseColorMode).toBe("white");
    expect(transparent.opacityWhenHasFinal).toBe(0);
    expect(transparent.depthWrite).toBe(false);
    expect(transparent.usePolygonOffset).toBe(false);
    expect(transparent.componentBuildMode).toBe("display-geometry-mesh");
    expect(transparent.allowSharedSolidFaceColorMap).toBe(false);
    expect(transparent.allowSharedSolidFaceOverlay).toBe(false);
    expect(transparent.usesFaceGroupPalette).toBe(false);
    expect(transparent.groupedFaceComponentOpacity).toBeNull();
  });

  it("grouped は merged geometry 側でも vertex colors を許可する", () => {
    const grouped = resolveTwinPreviewFaceProfile("grouped");
    const white = resolveTwinPreviewFaceProfile("white");

    expect(grouped.useVertexColorsOnMergedGeometry).toBe(true);
    expect(grouped.componentBuildMode).toBe("grouped-face-group");
    expect(white.useVertexColorsOnMergedGeometry).toBe(false);
    expect(white.componentBuildMode).toBe("display-geometry-mesh");
  });

  it("custom は渡した custom profile をそのまま反映する", () => {
    const customLine = createDefaultEditableTwinPreviewLineProfile();
    const customFace = createDefaultEditableTwinPreviewFaceProfile();

    customLine.useLayeredLines = true;
    customLine.showHiddenSurfaceLines = true;
    customLine.depthMaskOffsetFactor = 3;
    customLine.hiddenSurfaceLineColorMode = "custom";
    customLine.hiddenSurfaceLineCustomColor = "#123456";
    customLine.hiddenSurfaceLineWidthScale = 3.5;
    customFace.surfaceStyle = "transparent";
    customFace.usesLighting = false;
    customFace.opacityWhenHasFinal = 0.12;

    const lineProfile = resolveTwinPreviewLineProfile("custom", customLine);
    const faceProfile = resolveTwinPreviewFaceProfile("custom", customFace);

    expect(lineProfile.mode).toBe("custom");
    expect(lineProfile.useLayeredLines).toBe(true);
    expect(lineProfile.showHiddenSurfaceLines).toBe(true);
    expect(lineProfile.depthMaskOffsetFactor).toBe(3);
    expect(lineProfile.hiddenSurfaceLineColorMode).toBe("custom");
    expect(lineProfile.hiddenSurfaceLineCustomColor).toBe("#123456");
    expect(lineProfile.hiddenSurfaceLineWidthScale).toBe(3.5);
    expect(faceProfile.mode).toBe("custom");
    expect(faceProfile.surfaceStyle).toBe("transparent");
    expect(faceProfile.usesLighting).toBe(false);
    expect(faceProfile.opacityWhenHasFinal).toBe(0.12);
  });
});
