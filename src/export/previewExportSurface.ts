import * as THREE from "three";
import { buildThreeGeometry } from "../io/exporters.js";
import type { CrystalSystemId } from "../domain/crystalSystems.js";
import type { TwinPreviewStyleSettings } from "../preview/previewStyleSettings.js";
import {
  averageColors,
  getPreviewExportProfiles,
  getPreviewFaceExportOpacity as resolvePreviewFaceExportOpacity,
  shouldApplyPreviewLightingToVectorSvgBody as shouldApplyPreviewLightingToVectorSvgBodyByProfile,
  shouldMergeVectorSvgBodyFacesForExport as shouldMergeVectorSvgBodyFacesForExportByProfile,
  shouldUseBackFacingTrianglesForExport as shouldUseBackFacingTrianglesForExportByProfile,
  shouldUseVectorCrystalBodyForSvgExport as shouldUseVectorCrystalBodyForSvgExportByProfile,
} from "./previewExportSurfaceProfiles.js";
import {
  applyPreviewLightingToSvgFill,
  buildPreviewSvgLightingContext,
  createPreviewExportColorResolver,
  getApproximateMultiCrystalExportColor,
  type PreviewSvgLightingContext,
} from "./previewExportSurfaceRendering.js";
import {
  buildXrayExportSurfaceGeometry,
  collectTransparentXrayExportTriangles,
} from "./previewExportSurfaceGeometry.js";

/**
 * 双晶 preview export の surface 構築 helper 群。
 *
 * `main.ts` に残っていた export 用 surface 組み立て、xray triangle 化、
 * 色解決、lighting 近似をここへまとめる。
 * 依存は多いが、まずは runtime context ごと移して行数を減らす段階とする。
 */

interface PreviewExportSurfaceFaceLike {
  id?: string | null;
  coefficient?: number | string | null;
}

interface PreviewExportSurfaceMeshFaceLike {
  id?: string | null;
  normal?: { x: number; y: number; z: number } | null;
  vertices?: { x: number; y: number; z: number }[];
}

interface PreviewExportSurfaceMeshDataLike {
  faces?: PreviewExportSurfaceMeshFaceLike[] | null;
  faceVertexCounts?: { id?: string | null; vertexCount: number }[];
  [key: string]: unknown;
}

interface PreviewExportSurfaceCrystalLike {
  enabled?: boolean;
  twinType?: string;
}

interface PreviewExportSurfaceStateLike {
  parameters: {
    crystalSystem: CrystalSystemId;
  };
  buildResult: {
    previewFinalGeometry?: THREE.BufferGeometry | null;
    finalGeometry?: THREE.BufferGeometry | null;
    crystalPreviewMeshData?: PreviewExportSurfaceMeshDataLike[] | null;
  } | null;
  previewRoot: THREE.Group | null;
  faceDisplayMode: string;
  previewStyleSettings?: TwinPreviewStyleSettings;
}

interface PreviewExportSurfaceEntryLike {
  crystal: PreviewExportSurfaceCrystalLike | null;
  index: number;
  meshData: PreviewExportSurfaceMeshDataLike | null;
}

export interface TwinPreviewExportSurfaceContext {
  state: PreviewExportSurfaceStateLike;
  camera: THREE.Camera;
  raycaster: THREE.Raycaster;
  previewAmbientLight: THREE.AmbientLight;
  previewKeyLight: THREE.DirectionalLight;
  previewFillLight: THREE.DirectionalLight;
  buildPreviewBoundsSphere: () => { radius: number };
  getVisibleCrystalEntriesForExport: () => PreviewExportSurfaceEntryLike[];
  getTwinCrystals: (
    parameters: PreviewExportSurfaceStateLike["parameters"],
  ) => PreviewExportSurfaceCrystalLike[];
  getTwinCrystalFaces: (
    parameters: PreviewExportSurfaceStateLike["parameters"],
    index: number,
  ) => PreviewExportSurfaceFaceLike[];
  buildTwinFaceGroupPalette: (
    sourceFaces: PreviewExportSurfaceFaceLike[],
    crystalSystem: string,
  ) => {
    faceColors: Map<string | null | undefined, { preview: string }>;
    groupColors: Map<string, { preview: string }>;
  };
  getCrystalAccentColor: (index: number) => string;
  buildDisplayGeometry: (
    meshData: PreviewExportSurfaceMeshDataLike | null,
    sourceFaces: PreviewExportSurfaceFaceLike[],
    options?: {
      faceColorHexByFaceId?: Map<string | null | undefined, string> | null;
    },
  ) => THREE.BufferGeometry | null;
  buildFlatFaceColors: (
    meshData: PreviewExportSurfaceMeshDataLike,
    colorHex: string,
  ) => number[];
  projectWorldPointToExport: (
    worldPoint: THREE.Vector3,
    width: number,
    height: number,
  ) => { x: number; y: number; projectedZ: number; cameraZ: number };
  getExportMaterial: (
    object: THREE.Object3D & { material?: unknown },
  ) => unknown;
  hasNamedAncestor: (object: THREE.Object3D | null, name: string) => boolean;
  resolveXrayPreviewFaceColor: (
    faceId: string | null | undefined,
    sourceFaces: PreviewExportSurfaceFaceLike[],
    crystalIndex: number,
  ) => string;
  isXrayFaceDisplayMode: () => boolean;
}

/** export surface 生成時の戻り値。 */
interface PreviewExportSurfaceData {
  geometry: THREE.BufferGeometry;
  rootMatrix: THREE.Matrix4;
  fillOpacity: number;
  useVertexColors: boolean;
  fillColor: string | null;
  colorResolver:
    | ((
        sample: {
          projectedPoints?: { x: number; y: number }[];
          worldPoints?: THREE.Vector3[];
          worldNormal?: THREE.Vector3 | null;
        },
        fallbackFill: string,
      ) => string)
    | null;
  applyLighting: boolean;
  lightingContext: PreviewSvgLightingContext | null;
  includeBackFacingTriangles: boolean;
  sourceMode: string;
  dispose: () => void;
}

export function createTwinPreviewExportSurfaceActions(
  context: TwinPreviewExportSurfaceContext,
) {
  function hasHiddenCrystalEntriesForExport(
    visibleCrystalEntries: PreviewExportSurfaceEntryLike[],
  ) {
    const crystals = context.getTwinCrystals(context.state.parameters);
    const crystalMeshData =
      context.state.buildResult?.crystalPreviewMeshData ?? [];
    const exportEligibleCount = crystals
      .map((crystal, index) => ({
        crystal,
        index,
        meshData: crystalMeshData[index] ?? null,
      }))
      .filter(
        ({ crystal, index, meshData }) =>
          (index === 0 || crystal?.enabled !== false) && meshData,
      ).length;
    return visibleCrystalEntries.length < exportEligibleCount;
  }

  /** 単結晶は常に vector body、複数結晶は previewFinalGeometry がある場合だけ許可する。 */
  function shouldUseVectorCrystalBodyForSvgExport() {
    return shouldUseVectorCrystalBodyForSvgExportByProfile({
      visibleCrystalCount: context.getVisibleCrystalEntriesForExport().length,
      state: context.state,
    });
  }

  function getFaceProfile() {
    return getPreviewExportProfiles(context.state).faceProfile;
  }

  function getLineProfile() {
    return getPreviewExportProfiles(context.state).lineProfile;
  }

  function shouldUseBackFacingTrianglesForExport() {
    return shouldUseBackFacingTrianglesForExportByProfile(context.state);
  }

  /** 表示中の結晶に contact twin が含まれるかを返す。 */
  function hasVisibleContactTwinForSvgExport() {
    const crystals = context.getTwinCrystals(context.state.parameters);
    return context
      .getVisibleCrystalEntriesForExport()
      .some(
        ({ index }) =>
          index !== 0 &&
          crystals[index]?.enabled !== false &&
          crystals[index]?.twinType === "contact",
      );
  }

  /** vector SVG body で同色面結合を使うかを返す。 */
  function shouldMergeVectorSvgBodyFacesForExport() {
    return shouldMergeVectorSvgBodyFacesForExportByProfile(
      context.getVisibleCrystalEntriesForExport().length,
    );
  }

  /** vector SVG body に preview 照明を焼き込むべきかを返す。 */
  function shouldApplyPreviewLightingToVectorSvgBody() {
    return shouldApplyPreviewLightingToVectorSvgBodyByProfile({
      visibleCrystalCount: context.getVisibleCrystalEntriesForExport().length,
      state: context.state,
    });
  }

  /** 現在の表示モードに応じた SVG body の opacity を返す。 */
  function getPreviewFaceExportOpacity() {
    return resolvePreviewFaceExportOpacity(context.state);
  }

  /** 現在の表示モードに応じて、export 用 surface / opaqueTriangles を組み立てる。 */
  function getExportSurfaceData(
    width: number | null = null,
    height: number | null = null,
  ): PreviewExportSurfaceData | null {
    const visibleCrystalEntries = context.getVisibleCrystalEntriesForExport();
    if (!visibleCrystalEntries.length || !context.state.previewRoot) {
      return null;
    }

    const fillOpacity = getPreviewFaceExportOpacity();
    const temporaryGeometries: THREE.BufferGeometry[] = [];
    const faceProfile = getFaceProfile();
    const lineProfile = getLineProfile();

    if (visibleCrystalEntries.length === 1) {
      const [{ index, meshData }] = visibleCrystalEntries;
      const sourceFaces = context.getTwinCrystalFaces(
        context.state.parameters,
        index,
      );
      if (faceProfile.usesFaceGroupPalette) {
        const geometry = context.buildDisplayGeometry(meshData, sourceFaces);
        if (!geometry) {
          return null;
        }
        temporaryGeometries.push(geometry);
        return {
          geometry,
          rootMatrix: context.state.previewRoot.matrixWorld.clone(),
          fillOpacity,
          useVertexColors: true,
          fillColor: null,
          colorResolver: null,
          applyLighting: shouldApplyPreviewLightingToVectorSvgBody(),
          lightingContext: shouldApplyPreviewLightingToVectorSvgBody()
            ? buildPreviewSvgLightingContext({
                previewAmbientLight: context.previewAmbientLight,
                previewKeyLight: context.previewKeyLight,
                previewFillLight: context.previewFillLight,
              })
            : null,
          includeBackFacingTriangles: shouldUseBackFacingTrianglesForExport(),
          sourceMode:
            faceProfile.usesScreenSpaceFaceOverlay ||
            lineProfile.useScreenSpaceLineOverlay
              ? "xray-single-crystal-faces"
              : "single-crystal-grouped-faces",
          dispose() {
            temporaryGeometries.forEach((candidate) => candidate.dispose());
          },
        };
      }

      const geometry = buildThreeGeometry(meshData);
      if (!geometry) {
        return null;
      }
      temporaryGeometries.push(geometry);
      return {
        geometry,
        rootMatrix: context.state.previewRoot.matrixWorld.clone(),
        fillOpacity,
        useVertexColors: false,
        fillColor: `#${new THREE.Color(context.getCrystalAccentColor(index)).getHexString()}`,
        colorResolver: null,
        applyLighting: shouldApplyPreviewLightingToVectorSvgBody(),
        lightingContext: shouldApplyPreviewLightingToVectorSvgBody()
          ? buildPreviewSvgLightingContext({
              previewAmbientLight: context.previewAmbientLight,
              previewKeyLight: context.previewKeyLight,
              previewFillLight: context.previewFillLight,
            })
          : null,
        includeBackFacingTriangles: shouldUseBackFacingTrianglesForExport(),
        sourceMode:
          faceProfile.usesScreenSpaceFaceOverlay ||
          lineProfile.useScreenSpaceLineOverlay
            ? "xray-single-crystal-faces"
            : "single-crystal-faces",
        dispose() {
          temporaryGeometries.forEach((candidate) => candidate.dispose());
        },
      };
    }

    if (
      faceProfile.usesScreenSpaceFaceOverlay ||
      lineProfile.useScreenSpaceLineOverlay
    ) {
      const xraySurface = buildXrayExportSurfaceGeometry({
        visibleCrystalEntries,
        useGroupedColors: faceProfile.usesFaceGroupPalette,
        getTwinCrystalFaces: (index) =>
          context.getTwinCrystalFaces(context.state.parameters, index),
        buildDisplayGeometry: context.buildDisplayGeometry,
        buildFlatFaceColors: context.buildFlatFaceColors,
        getCrystalAccentColor: context.getCrystalAccentColor,
      });
      if (xraySurface.geometry) {
        return {
          geometry: xraySurface.geometry,
          rootMatrix: context.state.previewRoot.matrixWorld.clone(),
          fillOpacity,
          useVertexColors: true,
          fillColor: null,
          colorResolver: null,
          applyLighting: false,
          lightingContext: null,
          includeBackFacingTriangles: true,
          sourceMode: "xray-all-crystal-faces",
          dispose() {
            xraySurface.temporaryGeometries.forEach((candidate) =>
              candidate.dispose(),
            );
          },
        };
      }
    }

    if (hasHiddenCrystalEntriesForExport(visibleCrystalEntries)) {
      const visibleSurface = buildXrayExportSurfaceGeometry({
        visibleCrystalEntries,
        useGroupedColors: faceProfile.usesFaceGroupPalette,
        getTwinCrystalFaces: (index) =>
          context.getTwinCrystalFaces(context.state.parameters, index),
        buildDisplayGeometry: context.buildDisplayGeometry,
        buildFlatFaceColors: context.buildFlatFaceColors,
        getCrystalAccentColor: context.getCrystalAccentColor,
      });
      if (visibleSurface.geometry) {
        return {
          geometry: visibleSurface.geometry,
          rootMatrix: context.state.previewRoot.matrixWorld.clone(),
          fillOpacity,
          useVertexColors: true,
          fillColor: null,
          colorResolver: null,
          applyLighting: false,
          lightingContext: null,
          includeBackFacingTriangles: shouldUseBackFacingTrianglesForExport(),
          sourceMode: "visible-crystal-geometries",
          dispose() {
            visibleSurface.temporaryGeometries.forEach((candidate) =>
              candidate.dispose(),
            );
          },
        };
      }
    }

    const geometry =
      context.state.buildResult?.previewFinalGeometry ??
      context.state.buildResult?.finalGeometry ??
      null;
    if (!geometry?.getAttribute?.("position")) {
      return null;
    }
    const fillColor = getApproximateMultiCrystalExportColor({
      visibleCrystalEntries,
      faceProfile,
      state: context.state,
      getTwinCrystalFaces: context.getTwinCrystalFaces,
      buildTwinFaceGroupPalette: context.buildTwinFaceGroupPalette,
      getCrystalAccentColor: context.getCrystalAccentColor,
      averageColors,
    });
    return {
      geometry,
      rootMatrix: context.state.previewRoot.matrixWorld.clone(),
      fillOpacity,
      useVertexColors: false,
      fillColor: `#${fillColor.getHexString()}`,
      colorResolver:
        Number.isFinite(width) && Number.isFinite(height)
          ? createPreviewExportColorResolver({
              width,
              height,
              previewRoot: context.state.previewRoot,
              camera: context.camera,
              raycaster: context.raycaster,
              buildPreviewBoundsSphere: context.buildPreviewBoundsSphere,
              projectWorldPointToExport: context.projectWorldPointToExport,
              getExportMaterial: context.getExportMaterial,
              hasNamedAncestor: context.hasNamedAncestor,
            })
          : null,
      applyLighting: shouldApplyPreviewLightingToVectorSvgBody(),
      lightingContext: shouldApplyPreviewLightingToVectorSvgBody()
        ? buildPreviewSvgLightingContext({
            previewAmbientLight: context.previewAmbientLight,
            previewKeyLight: context.previewKeyLight,
            previewFillLight: context.previewFillLight,
          })
        : null,
      includeBackFacingTriangles: false,
      sourceMode: "final-geometry",
      dispose() {
        return;
      },
    };
  }

  return {
    shouldUseVectorCrystalBodyForSvgExport,
    hasVisibleContactTwinForSvgExport,
    shouldMergeVectorSvgBodyFacesForExport,
    applyPreviewLightingToSvgFill,
    averageColors,
    createPreviewExportColorResolver,
    getExportSurfaceData,
    getPreviewFaceExportOpacity,
    collectTransparentXrayExportTriangles: (
      width: number,
      height: number,
      rootMatrix: THREE.Matrix4 | null = null,
    ) =>
      collectTransparentXrayExportTriangles({
        width,
        height,
        rootMatrix,
        previewRoot: context.state.previewRoot,
        visibleCrystalEntries: context.getVisibleCrystalEntriesForExport(),
        fillOpacity: getPreviewFaceExportOpacity(),
        usesFaceGroupPalette: getFaceProfile().usesFaceGroupPalette,
        getTwinCrystalFaces: (index) =>
          context.getTwinCrystalFaces(context.state.parameters, index),
        getCrystalAccentColor: context.getCrystalAccentColor,
        resolveXrayPreviewFaceColor: context.resolveXrayPreviewFaceColor,
        projectWorldPointToExport: context.projectWorldPointToExport,
      }),
  };
}
