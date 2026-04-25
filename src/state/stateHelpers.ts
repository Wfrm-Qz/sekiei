/**
 * 双晶 parameter から結晶や面一覧を取り出す補助関数群。
 *
 * `main.ts` では同じ配列参照や twinType 判定を何度も行うため、
 * 副作用の少ない access helper を切り出して読みやすさを保つ。
 *
 * 主に扱う日本語文言:
 * - 結晶1 / 結晶 {index}
 * - C1 / C{index}
 */

/** 結晶タブや表示 toggle で使う「結晶1 / 結晶n」ラベルを返す。 */
export function formatCrystalUiLabel(index, translate) {
  return index === 0
    ? translate("crystals.first")
    : translate("crystals.indexed", { index: index + 1 });
}

/** 面一覧の左タブ列で使う短い結晶ラベルを返す。 */
export function formatCrystalTabLabel(index, translate) {
  return index === 0
    ? translate("crystals.firstShort")
    : translate("crystals.indexedShort", { index: index + 1 });
}

/** 双晶 parameter から指定結晶の face 配列を返す。 */
export function getTwinCrystalFaces(parameters, crystalIndex) {
  if (crystalIndex === 0) {
    return parameters.twin?.crystals?.[0]?.faces ?? parameters.faces ?? [];
  }
  return parameters.twin?.crystals?.[crystalIndex]?.faces ?? [];
}

/** 双晶内の結晶一覧を返す。 */
export function getTwinCrystals(parameters) {
  return Array.isArray(parameters?.twin?.crystals) &&
    parameters.twin.crystals.length > 0
    ? parameters.twin.crystals
    : [];
}

/** 指定 index の結晶定義を返す。 */
export function getTwinCrystal(parameters, crystalIndex) {
  return getTwinCrystals(parameters)[crystalIndex] ?? null;
}

/** 双晶モードが有効かを返す。 */
export function isTwinEnabled(parameters) {
  return Boolean(parameters?.twin?.enabled);
}

/** twinType から ruleType を決める。 */
export function twinRuleTypeForTwinType(twinType) {
  return twinType === "contact" ? "plane" : "axis";
}

/** 指定結晶の face 配列を差し替えた新 parameter object を返す。 */
export function setTwinCrystalFaces(parameters, crystalIndex, faces) {
  if (!Array.isArray(parameters.twin?.crystals)) {
    return;
  }
  parameters.twin.crystals[crystalIndex] = {
    ...parameters.twin.crystals[crystalIndex],
    faces,
  };
  if (crystalIndex === 0) {
    parameters.faces = structuredClone(faces);
  }
}

/** active crystal index を、現在の結晶数へ収まる値へ丸める。 */
export function clampActiveCrystalIndex(parameters, activeFaceCrystalIndex) {
  const crystals = getTwinCrystals(parameters);
  return Math.max(
    0,
    Math.min(activeFaceCrystalIndex, Math.max(0, crystals.length - 1)),
  );
}

/** 双晶軸 / 双晶面ガイド表示に使う結晶 index を返す。 */
export function getGuideCrystalIndex(parameters, activeFaceCrystalIndex) {
  const crystals = getTwinCrystals(parameters);
  const activeIndex = Math.max(
    1,
    Math.min(activeFaceCrystalIndex, Math.max(0, crystals.length - 1)),
  );
  if (activeIndex > 0 && crystals[activeIndex]?.enabled !== false) {
    return activeIndex;
  }
  return crystals.findIndex(
    (crystal, index) => index > 0 && crystal?.enabled !== false,
  );
}

/** 面グループの collapse 状態保存に使う state key を作る。 */
export function buildFaceGroupStateKey(
  editableCrystalIndex,
  groupKey,
  separator,
) {
  return `${editableCrystalIndex}${separator}${groupKey}`;
}

/** 双晶内の結晶 id を作る。 */
export function createCrystalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `crystal-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/** 面が有効表示かを返す。 */
export function isFaceEnabled(face) {
  return (
    face?.enabled !== false &&
    (!Array.isArray(face?.draftEmptyFields) ||
      face.draftEmptyFields.length === 0)
  );
}
