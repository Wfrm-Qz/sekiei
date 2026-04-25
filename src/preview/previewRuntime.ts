import {
  type EditableTwinPreviewFaceProfile,
  type EditableTwinPreviewLineProfile,
  resolveTwinPreviewFaceProfile,
  resolveTwinPreviewLineProfile,
} from "./previewProfiles.js";
import { getTwinCrystalFaces, getTwinCrystals } from "../state/stateHelpers.js";

interface PreviewRuntimeBuildResultLike {
  previewFinalGeometry?: unknown;
  finalGeometry?: unknown;
  crystalPreviewMeshData?:
    | {
        positions?: unknown[];
        faceVertexCounts?: { id: string | null; vertexCount: number }[];
        faces?: unknown[];
      }[]
    | null;
  crystalPreviewGeometries?: unknown[] | null;
  crystalStlCompositeGeometries?: unknown[] | null;
  errors?: unknown[] | null;
  warnings?: unknown[] | null;
}

interface PreviewRuntimeStateLike {
  parameters: {
    faces?: unknown[];
    twin?: {
      crystals?: { id?: string | null; faces?: unknown[] | null }[] | null;
    } | null;
  };
  buildResult: PreviewRuntimeBuildResultLike | null;
  faceDisplayMode: string;
  previewStyleSettings: {
    customFaceProfile?: unknown;
    customLineProfile?: unknown;
  };
  crystalVisibility: Record<string, boolean | undefined>;
}

type TwinMeshDataBuilder = (
  parameters: unknown,
) => PreviewRuntimeBuildResultLike;

interface PreviewRuntimeContext {
  state: PreviewRuntimeStateLike;
  previewBuildRequestRef: { current: number };
  loadTwinMeshDataBuilder: () => Promise<TwinMeshDataBuilder>;
  applyPreviewLightingMode: () => void;
  buildPreviewGroup: () => unknown;
  applyPreviewGroup: (group: unknown) => void;
  syncXrayFaceOverlayVisibility: () => void;
  requestPreviewRender: () => void;
  renderMessages: () => void;
  renderStats: () => void;
  getCrystalAccentColor: (index: number) => string;
  t: (key: string, params?: Record<string, unknown>) => string;
}

/**
 * preview runtime に密結合な helper 群。
 *
 * `main.ts` から切り離し、state と callback だけを受けることで wiring と runtime を分離する。
 */
export function createTwinPreviewRuntimeActions(
  context: PreviewRuntimeContext,
) {
  function downloadPreviewDebugSnapshot() {
    const faceProfile = resolveTwinPreviewFaceProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings.customFaceProfile as
        | EditableTwinPreviewFaceProfile
        | undefined,
    );
    const lineProfile = resolveTwinPreviewLineProfile(
      context.state.faceDisplayMode,
      context.state.previewStyleSettings.customLineProfile as
        | EditableTwinPreviewLineProfile
        | undefined,
    );
    const buildResultSummary = context.state.buildResult
      ? {
          hasPreviewFinalGeometry: Boolean(
            context.state.buildResult.previewFinalGeometry,
          ),
          hasFinalGeometry: Boolean(context.state.buildResult.finalGeometry),
          crystalPreviewMeshDataCount:
            context.state.buildResult.crystalPreviewMeshData?.length ?? 0,
          crystalPreviewGeometriesCount:
            context.state.buildResult.crystalPreviewGeometries?.length ?? 0,
          crystalStlCompositeGeometriesCount:
            context.state.buildResult.crystalStlCompositeGeometries?.length ??
            0,
          previewMessages: {
            errors: context.state.buildResult.errors?.length ?? 0,
            warnings: context.state.buildResult.warnings?.length ?? 0,
          },
        }
      : null;
    const snapshot = {
      schema: "twin-preview-debug-snapshot-v1",
      generatedAt: new Date().toISOString(),
      faceDisplayMode: context.state.faceDisplayMode,
      parameters: structuredClone(context.state.parameters),
      previewStyleSettings: structuredClone(context.state.previewStyleSettings),
      resolvedProfiles: {
        faceProfile,
        lineProfile,
      },
      buildResultSummary,
      debug: {
        faceTextPreview:
          (globalThis as Record<string, unknown>).__faceTextPreviewDebug ??
          null,
        twinPreviewLines:
          (globalThis as Record<string, unknown>).__twinPreviewLineDebug ??
          null,
        twinXraySort:
          (globalThis as Record<string, unknown>).__twinXraySortDebug ?? null,
        twinXrayScreenOverlay:
          (globalThis as Record<string, unknown>)
            .__twinXrayScreenOverlayDebug ?? null,
        twinXrayScreenOverlayLine:
          (globalThis as Record<string, unknown>)
            .__twinXrayScreenOverlayLineDebug ?? null,
      },
    };

    const blob = new Blob([JSON.stringify(snapshot, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `twin-preview-debug-${timestamp}.json`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function isCrystalVisible(
    crystal: { id?: string | null } | null | undefined,
    index: number,
  ) {
    const key = crystal?.id ?? `crystal-${index}`;
    return context.state.crystalVisibility[key] !== false;
  }

  function setCrystalVisibilityDefaults(parameters = context.state.parameters) {
    const nextVisibility: Record<string, boolean> = {};
    getTwinCrystals(parameters).forEach((crystal, index) => {
      const key = crystal?.id ?? `crystal-${index}`;
      nextVisibility[key] = context.state.crystalVisibility[key] ?? true;
    });
    context.state.crystalVisibility = nextVisibility;
  }

  function hasAnyFaceTextContent(parameters = context.state.parameters) {
    const faceCollections = [
      parameters.faces,
      ...(parameters.twin?.crystals?.map((crystal) => crystal.faces) ?? []),
    ];

    return faceCollections.some((faces) =>
      Array.isArray(faces)
        ? faces.some(
            (face) =>
              String(
                (face as { text?: { content?: string } })?.text?.content ?? "",
              ).trim() !== "",
          )
        : false,
    );
  }

  function buildFaceTextDebugSummary(
    parameters = context.state.parameters,
    buildResult = context.state.buildResult,
  ) {
    const crystals = getTwinCrystals(parameters);
    const faceTexts = crystals.flatMap((crystal, crystalIndex) =>
      getTwinCrystalFaces(parameters, crystalIndex)
        .filter((face) => String(face?.text?.content ?? "").trim() !== "")
        .map((face) => ({
          crystalIndex,
          faceId: face.id ?? null,
          content: String(face.text?.content ?? ""),
          fontId: face.text?.fontId ?? null,
          fontSize: Number(face.text?.fontSize ?? Number.NaN),
          depth: Number(face.text?.depth ?? Number.NaN),
        })),
    );
    const firstMeshData = buildResult?.crystalPreviewMeshData?.[0] ?? null;
    return {
      schema: "face-text-preview-debug-v1",
      faceDisplayMode: context.state.faceDisplayMode,
      visibleTextFaceCount: faceTexts.length,
      faces: faceTexts,
      firstCrystalMesh: firstMeshData
        ? {
            positionsCount: Array.isArray(firstMeshData.positions)
              ? firstMeshData.positions.length / 3
              : 0,
            faceVertexCounts:
              firstMeshData.faceVertexCounts?.map((item) => ({
                id: item.id,
                vertexCount: item.vertexCount,
              })) ?? [],
            faceCount: firstMeshData.faces?.length ?? 0,
          }
        : null,
      hasPreviewFinalGeometry: Boolean(buildResult?.previewFinalGeometry),
      hasFinalGeometry: Boolean(buildResult?.finalGeometry),
    };
  }

  function setPreview() {
    context.applyPreviewLightingMode();
    const nextPreviewGroup = context.buildPreviewGroup();
    context.applyPreviewGroup(nextPreviewGroup);
    context.syncXrayFaceOverlayVisibility();
    context.requestPreviewRender();
  }

  async function syncPreview() {
    const requestId = ++context.previewBuildRequestRef.current;
    try {
      const buildTwinMeshData = await context.loadTwinMeshDataBuilder();
      const nextBuildResult = buildTwinMeshData(context.state.parameters);
      if (requestId !== context.previewBuildRequestRef.current) {
        return;
      }
      context.state.buildResult = nextBuildResult;
      if (hasAnyFaceTextContent(context.state.parameters)) {
        const summary = buildFaceTextDebugSummary(
          context.state.parameters,
          nextBuildResult,
        );
        (globalThis as Record<string, unknown>).__faceTextPreviewDebug =
          summary;
        console.info("[Face Text Preview]", summary);
      }
      context.renderMessages();
      context.renderStats();
      setPreview();
    } catch (error) {
      if (requestId !== context.previewBuildRequestRef.current) {
        return;
      }
      console.error("[Twin Preview] syncPreview failed", error);
    }
  }

  return {
    downloadPreviewDebugSnapshot,
    isCrystalVisible,
    setCrystalVisibilityDefaults,
    hasAnyFaceTextContent,
    buildFaceTextDebugSummary,
    setPreview,
    syncPreview,
  };
}
