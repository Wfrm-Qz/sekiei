/**
 * 結晶系ごとの固定語彙と、軸長・角度・指数表示に関する制約ルールを扱う。
 *
 * 面生成や JSON 正規化、UI の入力制御が同じ結晶系ルールを共有するため、
 * 結晶系依存の制約はこの module に集約する。
 */

/** 現在サポートしている結晶系 id。 */
export type CrystalSystemId =
  | "cubic"
  | "tetragonal"
  | "orthorhombic"
  | "hexagonal"
  | "trigonal"
  | "monoclinic"
  | "triclinic";

/** UI で選べる結晶系一覧。label は i18n と別管理の固定語彙。 */
export const CRYSTAL_SYSTEMS: {
  id: CrystalSystemId;
  label: { ja: string; en: string };
}[] = [
  { id: "cubic", label: { ja: "立方晶系", en: "Cubic" } },
  { id: "tetragonal", label: { ja: "正方晶系", en: "Tetragonal" } },
  { id: "orthorhombic", label: { ja: "直方晶系", en: "Orthorhombic" } },
  { id: "hexagonal", label: { ja: "六方晶系", en: "Hexagonal" } },
  { id: "trigonal", label: { ja: "三方晶系", en: "Trigonal" } },
  { id: "monoclinic", label: { ja: "単斜晶系", en: "Monoclinic" } },
  { id: "triclinic", label: { ja: "三斜晶系", en: "Triclinic" } },
];

/**
 * 結晶系ごとの入力拘束ルール。
 *
 * 軸長や角度の同期は UI 上でも見えるが、JSON 正規化や双晶側の複製でも同じ制約が必要なので
 * ここで一元管理する。
 */
export const SYSTEM_FIELD_RULES = {
  cubic: {
    axisLocks: { b: "a", c: "a" },
    angleLocks: { alpha: 90, beta: 90, gamma: 90 },
  },
  tetragonal: {
    axisLocks: { b: "a" },
    angleLocks: { alpha: 90, beta: 90, gamma: 90 },
  },
  orthorhombic: {
    axisLocks: {},
    angleLocks: { alpha: 90, beta: 90, gamma: 90 },
  },
  hexagonal: {
    axisLocks: { b: "a" },
    angleLocks: { alpha: 90, beta: 90, gamma: 120 },
  },
  trigonal: {
    axisLocks: { b: "a" },
    angleLocks: { alpha: 90, beta: 90, gamma: 120 },
  },
  monoclinic: {
    axisLocks: {},
    angleLocks: { alpha: 90, gamma: 90 },
  },
  triclinic: {
    axisLocks: {},
    angleLocks: {},
  },
} as const;

/** 結晶系オブジェクトから現在言語向けのラベル文字列を返す。 */
export function getCrystalSystemLabel(
  system: { id?: string; label?: string | { ja?: string; en?: string } } | null,
  locale = "ja",
) {
  if (!system) {
    return "";
  }
  if (typeof system.label === "string") {
    return system.label;
  }
  if (system.label && typeof system.label === "object") {
    return (
      system.label[locale] ??
      system.label.ja ??
      system.label.en ??
      system.id ??
      ""
    );
  }
  return system.id ?? "";
}

/** 結晶系の制約を軸長・角度へ適用した、新しい parameter object を返す。 */
export function applyCrystalSystemConstraints<
  TParameters extends {
    crystalSystem: string;
    axes: Record<string, number>;
    angles: Record<string, number>;
  },
>(parameters: TParameters) {
  const next = structuredClone(parameters);
  const rules =
    SYSTEM_FIELD_RULES[next.crystalSystem] ?? SYSTEM_FIELD_RULES.triclinic;
  const axisLocks = rules.axisLocks as Record<string, string | number>;
  const angleLocks = rules.angleLocks as Record<string, string | number>;

  for (const [target, source] of Object.entries(axisLocks)) {
    next.axes[target] = typeof source === "string" ? next.axes[source] : source;
  }

  for (const [target, source] of Object.entries(angleLocks)) {
    next.angles[target] =
      typeof source === "string" ? next.angles[source] : source;
  }

  return next;
}

/** 指定フィールドが結晶系制約により UI 上で固定されるかを返す。 */
export function isFieldLocked(
  systemId: string,
  fieldType: "axis" | "angle",
  fieldName: string,
) {
  const rules = SYSTEM_FIELD_RULES[systemId] ?? SYSTEM_FIELD_RULES.triclinic;
  const sourceMap = (fieldType === "axis"
    ? rules.axisLocks
    : rules.angleLocks) as Record<string, string | number>;
  return fieldName in sourceMap;
}

/** 六方晶系・三方晶系で hkil の 4 指数表示を使うかを返す。 */
export function usesFourAxisMiller(systemId: CrystalSystemId | string) {
  return systemId === "hexagonal" || systemId === "trigonal";
}
