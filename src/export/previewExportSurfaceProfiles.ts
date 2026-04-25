import * as THREE from "three";
import {
  resolveTwinPreviewFaceOpacity,
  resolveTwinPreviewFaceProfile,
  resolveTwinPreviewLineProfile,
} from "../preview/previewProfiles.js";
import type { TwinPreviewStyleSettings } from "../preview/previewStyleSettings.js";

interface PreviewExportSurfaceProfileStateLike {
  buildResult: {
    previewFinalGeometry?: THREE.BufferGeometry | null;
    finalGeometry?: THREE.BufferGeometry | null;
  } | null;
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
}

export function getPreviewExportProfiles(
  state: PreviewExportSurfaceProfileStateLike,
) {
  return {
    faceProfile: resolveTwinPreviewFaceProfile(
      state.faceDisplayMode,
      state.previewStyleSettings?.customFaceProfile,
    ),
    lineProfile: resolveTwinPreviewLineProfile(
      state.faceDisplayMode,
      state.previewStyleSettings?.customLineProfile,
    ),
  };
}

export function shouldUseVectorCrystalBodyForSvgExport(options: {
  visibleCrystalCount: number;
  state: PreviewExportSurfaceProfileStateLike;
}) {
  if (!options.visibleCrystalCount) {
    return false;
  }
  if (options.visibleCrystalCount === 1) {
    return true;
  }
  return Boolean(
    options.state.buildResult?.previewFinalGeometry?.getAttribute?.("position"),
  );
}

export function shouldMergeVectorSvgBodyFacesForExport(
  visibleCrystalCount: number,
) {
  return visibleCrystalCount === 1;
}

export function shouldUseBackFacingTrianglesForExport(
  state: PreviewExportSurfaceProfileStateLike,
) {
  const { lineProfile } = getPreviewExportProfiles(state);
  return (
    lineProfile.showHiddenSurfaceLines || lineProfile.showOccludedInteriorLines
  );
}

export function shouldApplyPreviewLightingToVectorSvgBody(options: {
  visibleCrystalCount: number;
  state: PreviewExportSurfaceProfileStateLike;
}) {
  const { faceProfile } = getPreviewExportProfiles(options.state);
  return (
    shouldUseVectorCrystalBodyForSvgExport(options) &&
    faceProfile.usesLighting &&
    !faceProfile.usesScreenSpaceFaceOverlay
  );
}

export function getPreviewFaceExportOpacity(
  state: PreviewExportSurfaceProfileStateLike,
) {
  const { faceProfile } = getPreviewExportProfiles(state);
  const hasFinal = Boolean(
    state.buildResult?.previewFinalGeometry ?? state.buildResult?.finalGeometry,
  );
  return resolveTwinPreviewFaceOpacity(faceProfile, {
    hasFinal,
    preferGroupedFaceComponentOpacity: faceProfile.usesFaceGroupPalette,
  });
}

export function averageColors(colors: THREE.Color[]) {
  if (!colors.length) {
    return new THREE.Color("#d1b36a");
  }
  const sum = colors.reduce(
    (accumulator, color) => accumulator.add(color),
    new THREE.Color(0, 0, 0),
  );
  return sum.multiplyScalar(1 / colors.length);
}
