import { describe, expect, it, vi } from "vitest";
import { createDefaultTwinParameters } from "../../../src/domain/parameters.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../src/preview/previewStyleSettings.ts";
import { createTwinPreviewRuntimeActions } from "../../../src/preview/previewRuntime.ts";

describe("preview/previewRuntime", () => {
  function createContext() {
    const parameters = createDefaultTwinParameters();
    parameters.twin.crystals = [
      {
        ...parameters.twin.crystals[0],
        id: "crystal-a",
      },
      {
        ...structuredClone(parameters.twin.crystals[0]),
        id: "crystal-b",
      },
    ];
    return {
      state: {
        parameters,
        buildResult: null,
        faceDisplayMode: "solid",
        previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
        crystalVisibility: { "crystal-a": false },
      },
      previewBuildRequestRef: { current: 0 },
      loadTwinMeshDataBuilder: vi.fn(async () =>
        vi.fn(() => ({ errors: [], warnings: [] })),
      ),
      applyPreviewLightingMode: vi.fn(),
      buildPreviewGroup: vi.fn(() => ({ tag: "preview-group" })),
      applyPreviewGroup: vi.fn(),
      syncXrayFaceOverlayVisibility: vi.fn(),
      requestPreviewRender: vi.fn(),
      renderMessages: vi.fn(),
      renderStats: vi.fn(),
      getCrystalAccentColor: vi.fn(() => "#ffffff"),
      t: vi.fn((key: string) => key),
    };
  }

  it("setCrystalVisibilityDefaults は既存 visibility を保ちつつ未設定 crystal を true で補う", () => {
    const context = createContext();
    const actions = createTwinPreviewRuntimeActions(context);

    actions.setCrystalVisibilityDefaults();

    expect(context.state.crystalVisibility).toEqual({
      "crystal-a": false,
      "crystal-b": true,
    });
    expect(actions.isCrystalVisible({ id: "crystal-a" }, 0)).toBe(false);
    expect(actions.isCrystalVisible({ id: "crystal-b" }, 1)).toBe(true);
  });

  it("hasAnyFaceTextContent と buildFaceTextDebugSummary は twin face text を拾う", () => {
    const context = createContext();
    context.state.parameters.twin.crystals[1].faces[0].text = {
      content: "Quartz",
      fontId: "helvetiker",
      fontSize: 5,
      depth: 1,
    };
    const actions = createTwinPreviewRuntimeActions(context);

    expect(actions.hasAnyFaceTextContent()).toBe(true);
    expect(
      actions.buildFaceTextDebugSummary(context.state.parameters, {
        crystalPreviewMeshData: [
          {
            positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
            faceVertexCounts: [{ id: "f-1", vertexCount: 3 }],
            faces: [{}],
          },
        ],
      }).visibleTextFaceCount,
    ).toBe(1);
  });

  it("syncPreview は buildResult を更新し、描画再同期 callback を呼ぶ", async () => {
    const context = createContext();
    const nextBuildResult = {
      errors: ["warn-error"],
      warnings: ["warn"],
      finalGeometry: { tag: "final" },
    };
    context.loadTwinMeshDataBuilder = vi.fn(async () =>
      vi.fn(() => nextBuildResult),
    );
    const actions = createTwinPreviewRuntimeActions(context);

    await actions.syncPreview();

    expect(context.state.buildResult).toBe(nextBuildResult);
    expect(context.renderMessages).toHaveBeenCalledTimes(1);
    expect(context.renderStats).toHaveBeenCalledTimes(1);
    expect(context.applyPreviewLightingMode).toHaveBeenCalledTimes(1);
    expect(context.buildPreviewGroup).toHaveBeenCalledTimes(1);
    expect(context.applyPreviewGroup).toHaveBeenCalledWith({
      tag: "preview-group",
    });
    expect(context.syncXrayFaceOverlayVisibility).toHaveBeenCalledTimes(1);
    expect(context.requestPreviewRender).toHaveBeenCalledTimes(1);
  });
});
