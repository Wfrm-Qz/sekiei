import { describe, expect, it, vi } from "vitest";
import {
  appendDerivedCrystal,
  createTwinCrystalMutationActions,
  removeCrystalAtIndex,
} from "../../../src/state/crystalMutations.ts";

/**
 * state/crystalMutations の結晶追加・削除 mutation を確認する unit test。
 */
describe("state/crystalMutations", () => {
  function createParameters() {
    return {
      crystalSystem: "cubic",
      twin: {
        enabled: false,
        crystals: [
          {
            id: "base",
            enabled: true,
            faces: [{ id: "f1", h: 1, k: 0, l: 0, coefficient: 1 }],
          },
          {
            id: "derived-1",
            enabled: true,
            from: 0,
            faces: [{ id: "f2", h: -1, k: 0, l: 0, coefficient: 1 }],
          },
        ],
      },
    };
  }

  it("appendDerivedCrystal は正常系で derived crystal を追加する", () => {
    const next = createParameters();
    next.twin.crystals[0].faces[0].text = {
      content: "A",
      fontId: "helvetiker",
      fontSize: 5,
      depth: 1,
      offsetU: 0,
      offsetV: 0,
      rotationDeg: 0,
    };

    appendDerivedCrystal(next, 0, next.twin.crystals[0].faces);

    expect(next.twin.enabled).toBe(true);
    expect(next.twin.crystals).toHaveLength(3);
    expect(next.twin.crystals[2].from).toBe(0);
    expect(next.twin.crystals[2].twinType).toBe("penetration");
    expect(next.twin.crystals[2].faces).not.toBe(next.twin.crystals[0].faces);
    expect(next.twin.crystals[2].faces[0].text).toEqual(
      next.twin.crystals[0].faces[0].text,
    );
    expect(next.twin.crystals[2].faces[0].text).not.toBe(
      next.twin.crystals[0].faces[0].text,
    );
  });

  it("removeCrystalAtIndex は基準結晶削除を拒否し、派生結晶削除時は twin enabled を再計算する", () => {
    const next = createParameters();

    expect(removeCrystalAtIndex(next, 0)).toBe(false);
    expect(removeCrystalAtIndex(next, 1)).toBe(true);
    expect(next.twin.crystals).toHaveLength(1);
    expect(next.twin.enabled).toBe(false);
  });

  it("createTwinCrystalMutationActions は confirm false で中断し、true なら state と preview を更新する", () => {
    const parameters = createParameters();
    const renderFormValues = vi.fn();
    const syncPreview = vi.fn();
    const commitParameters = vi.fn((mutator) => mutator(parameters));
    const context = {
      state: { activeFaceCrystalIndex: 1 },
      commitParameters,
      renderFormValues,
      syncPreview,
      confirm: vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true),
      t: vi.fn().mockReturnValue("confirm"),
    };
    const actions = createTwinCrystalMutationActions(context);

    expect(actions.deleteCrystalAtIndex(1)).toBe(false);
    expect(actions.deleteCrystalAtIndex(1)).toBe(true);
    expect(commitParameters).toHaveBeenCalledTimes(1);
    expect(context.state.activeFaceCrystalIndex).toBe(0);
    expect(renderFormValues).toHaveBeenCalledTimes(1);
    expect(syncPreview).toHaveBeenCalledTimes(1);
  });
});
