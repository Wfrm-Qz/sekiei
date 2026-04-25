import { describe, expect, it, vi } from "vitest";
import { createDefaultTwinParameters } from "../../../../src/domain/parameters.ts";
import { createDefaultTwinPreviewStyleSettings } from "../../../../src/preview/previewStyleSettings.ts";
import {
  applyTwinPresetToState,
  shouldApplyPresetPreviewSettings,
} from "../../../../src/ui/preset/presetApplication.ts";

describe("ui/preset/presetApplication", () => {
  function createState() {
    const parameters = createDefaultTwinParameters();
    parameters.twin.enabled = true;
    parameters.twin.crystals.push({
      ...structuredClone(parameters.twin.crystals[0]),
      id: "derived-1",
      from: 0,
    });
    parameters.twin.crystals.push({
      ...structuredClone(parameters.twin.crystals[0]),
      id: "derived-2",
      from: 1,
    });
    return {
      parameters,
      faceDisplayMode: "solid",
      previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
      activeFaceCrystalIndex: 2,
      pendingPreviewRefit: false,
    };
  }

  it("shouldApplyPresetPreviewSettings は現状 false 固定", () => {
    expect(shouldApplyPresetPreviewSettings()).toBe(false);
  });

  it("twin block を持たない preset は現在の crystal 数を保ったまま face を配る", () => {
    const state = createState();
    const onAfterApply = vi.fn();
    const onAfterSync = vi.fn();

    applyTwinPresetToState({
      state,
      preset: {
        id: "text-preset",
        parameters: {
          version: 2,
          schema: "sekiei-document",
          crystalSystem: "cubic",
          axes: { a: 1, b: 1, c: 1 },
          angles: { alpha: 90, beta: 90, gamma: 90 },
          sizeMm: 50,
          faces: [
            {
              id: "face-1",
              h: 1,
              k: 0,
              l: 0,
              coefficient: 1,
              text: {
                content: "A",
                fontId: "helvetiker",
                fontSize: 5,
                depth: 1,
                offsetU: 0,
                offsetV: 0,
                rotationDeg: 0,
              },
            },
          ],
        },
      },
      onAfterApply,
      onAfterSync,
    });

    expect(state.parameters.twin.crystals).toHaveLength(3);
    expect(state.parameters.presetId).toBe("text-preset");
    expect(
      state.parameters.twin.crystals.every((crystal) =>
        crystal.faces.some((face) => String(face.text?.content ?? "") === "A"),
      ),
    ).toBe(true);
    expect(state.activeFaceCrystalIndex).toBe(0);
    expect(state.pendingPreviewRefit).toBe(true);
    expect(onAfterApply).toHaveBeenCalledTimes(1);
    expect(onAfterSync).toHaveBeenCalledTimes(1);
  });

  it("preview 付き preset も、明示的に許可した時だけ preview 設定を適用する", () => {
    const state = createState();

    applyTwinPresetToState({
      state,
      preset: {
        id: "wrapper-preset",
        parameters: createDefaultTwinParameters(),
        preview: {
          faceDisplayMode: "xray-solid",
          previewStyleSettings: {
            ridgeLines: { color: "#334455", width: 4, opacity: 0.8 },
          },
        },
      },
      shouldApplyPresetPreviewSettings: () => true,
      onAfterApply: vi.fn(),
      onAfterSync: vi.fn(),
    });

    expect(state.faceDisplayMode).toBe("xray-solid");
    expect(state.previewStyleSettings.ridgeLines.color).toBe("#334455");
    expect(state.previewStyleSettings.ridgeLines.width).toBe(4);
    expect(state.previewStyleSettings.ridgeLines.opacity).toBe(0.8);
  });
});
