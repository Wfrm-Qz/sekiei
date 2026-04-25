import { createFace } from "../constants.js";
import { createDefaultTwinAxisRule } from "../domain/parameters.js";
import { createCrystalId } from "./stateHelpers.js";

/**
 * 結晶配列の追加 / 削除を扱う mutation helper。
 *
 * entry や UI handler から直接 twin crystal 配列を書き換えるロジックを減らし、
 * 結晶追加/削除の shape をここへ寄せる。
 *
 * 主に扱う日本語文言:
 * - この結晶を削除しますか。
 */

interface TwinCrystalLike {
  id?: string | null;
  accentColor?: string | null;
  role?: string;
  enabled?: boolean;
  from?: number;
  twinType?: string;
  ruleType?: string;
  plane?: unknown;
  axis?: unknown;
  rotationAngleDeg?: number;
  faces?: unknown[];
  contact?: {
    baseFaceRef?: string | null;
    derivedFaceRef?: string | null;
  } | null;
}

interface TwinParametersLike {
  crystalSystem: string;
  twin: {
    enabled: boolean;
    crystals: TwinCrystalLike[];
  };
}

/** 現在の結晶を複製元にして、新しい derived crystal を twin 配列へ追加する。 */
export function appendDerivedCrystal(
  next: TwinParametersLike,
  sourceIndex: number,
  sourceFaces: { id?: string | null }[],
) {
  next.twin.enabled = true;
  next.twin.crystals.push({
    id: createCrystalId(),
    accentColor: null,
    role: "derived",
    from: sourceIndex,
    enabled: true,
    twinType: "penetration",
    ruleType: "axis",
    plane: createFace({ h: 1, k: 1, l: 1, coefficient: 1 }),
    axis: createDefaultTwinAxisRule(next.crystalSystem),
    rotationAngleDeg: 60,
    contact: {
      baseFaceRef: sourceFaces[0]?.id ?? null,
      derivedFaceRef: sourceFaces[0]?.id ?? null,
    },
    faces: structuredClone(sourceFaces),
  });
}

/**
 * 結晶削除後の `from` 参照と twin enabled 状態を整える。
 *
 * 実際の confirm や active index 更新は UI/entry 側で持ち、この helper は
 * parameter object の整形だけを扱う。
 */
export function removeCrystalAtIndex(next: TwinParametersLike, index: number) {
  if (index === 0) {
    return false;
  }

  next.twin.crystals.splice(index, 1);
  next.twin.crystals = next.twin.crystals.map((crystal, crystalIndex) => ({
    ...crystal,
    from:
      crystalIndex === 0
        ? 0
        : Math.max(0, Math.min(Number(crystal.from ?? 0), crystalIndex - 1)),
  }));
  next.twin.enabled =
    next.twin.crystals.length > 1 &&
    next.twin.crystals.some(
      (crystal, crystalIndex) => crystalIndex > 0 && crystal.enabled !== false,
    );
  return true;
}

export interface TwinCrystalMutationActionsContext {
  state: {
    activeFaceCrystalIndex: number;
  };
  commitParameters: (mutator: (next: TwinParametersLike) => void) => void;
  renderFormValues: () => void;
  syncPreview: () => void;
  confirm: (message: string) => boolean;
  t: (key: string, params?: Record<string, string>) => string;
}

/** UI から呼びやすい結晶 mutation action を返す。 */
export function createTwinCrystalMutationActions(
  context: TwinCrystalMutationActionsContext,
) {
  /** 指定 index の derived crystal を削除し、参照元 index の整合も取り直す。 */
  function deleteCrystalAtIndex(index: number) {
    if (index === 0) {
      return false;
    }
    if (!context.confirm(context.t("crystals.deleteConfirm"))) {
      return false;
    }
    context.commitParameters((next) => {
      removeCrystalAtIndex(next, index);
    });
    context.state.activeFaceCrystalIndex = Math.max(0, index - 1);
    context.renderFormValues();
    context.syncPreview();
    return true;
  }

  return {
    appendDerivedCrystal,
    deleteCrystalAtIndex,
  };
}
