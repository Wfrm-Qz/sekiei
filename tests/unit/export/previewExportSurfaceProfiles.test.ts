import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import {
  averageColors,
  getPreviewExportProfiles,
  getPreviewFaceExportOpacity,
  shouldApplyPreviewLightingToVectorSvgBody,
  shouldMergeVectorSvgBodyFacesForExport,
  shouldUseBackFacingTrianglesForExport,
  shouldUseVectorCrystalBodyForSvgExport,
} from "../../../src/export/previewExportSurfaceProfiles.ts";

describe("export/previewExportSurfaceProfiles", () => {
  function createState() {
    return {
      buildResult: null,
      faceDisplayMode: "solid",
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
    };
  }

  it("profile 解決 helper は face / line profile をまとめて返す", () => {
    const profiles = getPreviewExportProfiles(createState());
    expect(profiles.faceProfile.mode).toBe("solid");
    expect(profiles.lineProfile.mode).toBe("solid");
  });

  it("vector body / merge / lighting 判定は visible crystal 数と profile に従う", () => {
    const state = createState();
    expect(
      shouldUseVectorCrystalBodyForSvgExport({ visibleCrystalCount: 0, state }),
    ).toBe(false);
    expect(
      shouldUseVectorCrystalBodyForSvgExport({ visibleCrystalCount: 1, state }),
    ).toBe(true);
    expect(shouldMergeVectorSvgBodyFacesForExport(1)).toBe(true);
    expect(shouldMergeVectorSvgBodyFacesForExport(2)).toBe(false);
    expect(
      shouldApplyPreviewLightingToVectorSvgBody({
        visibleCrystalCount: 1,
        state,
      }),
    ).toBe(true);
  });

  it("back-facing triangle と face opacity は profile から解決する", () => {
    const state = createState();
    state.faceDisplayMode = "custom";
    state.previewStyleSettings.customLineProfile.showHiddenSurfaceLines = true;
    state.previewStyleSettings.customFaceProfile.opacityWhenHasFinal = 0.4;
    state.buildResult = { finalGeometry: new THREE.BufferGeometry() };

    expect(shouldUseBackFacingTrianglesForExport(state)).toBe(true);
    expect(getPreviewFaceExportOpacity(state)).toBe(0.4);
  });

  it("averageColors は空配列 fallback と平均色の両方を扱う", () => {
    expect(averageColors([]).getHexString()).toBe("d1b36a");
    const averaged = averageColors([
      new THREE.Color("#000000"),
      new THREE.Color("#ffffff"),
    ]);
    expect(averaged.r).toBeCloseTo(0.5, 6);
    expect(averaged.g).toBeCloseTo(0.5, 6);
    expect(averaged.b).toBeCloseTo(0.5, 6);
  });
});
