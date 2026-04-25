import * as THREE from "three";
import {
  usesFourAxisMiller,
  type CrystalSystemId,
} from "./crystalSystems.js";

/**
 * 接触双晶の「基準方向」選択肢と、実際の軸ベクトル解決を担当する。
 *
 * 接触面法線を合わせたあとに残る面内回転を決めるための補助であり、
 * UI 表示用ラベルの列挙と builder 用の方向ベクトル解決を同じ規則で扱う。
 */

/** 四軸系で選択可能な接触双晶の基準方向ラベル。 */
const FOUR_AXIS_CONTACT_REFERENCE_LABELS = Object.freeze([
  "a1",
  "-a1",
  "a2",
  "-a2",
  "a3",
  "-a3",
  "c",
  "-c",
]);

/** 三軸系で選択可能な接触双晶の基準方向ラベル。 */
const THREE_AXIS_CONTACT_REFERENCE_LABELS = Object.freeze([
  "a",
  "-a",
  "b",
  "-b",
  "c",
  "-c",
]);

/** `-a2` のような符号付き軸ラベルを「符号」と「軸名」に分解する。 */
function splitSignedAxisLabel(axisLabel) {
  const normalized = typeof axisLabel === "string" ? axisLabel.trim() : "";
  if (!normalized) {
    return { sign: 1, baseLabel: null };
  }
  if (normalized.startsWith("-")) {
    return { sign: -1, baseLabel: normalized.slice(1) || null };
  }
  return { sign: 1, baseLabel: normalized };
}

/**
 * UI ラベルと axis guide の別名を吸収する。
 *
 * 例:
 * - 三軸系 `a` と四軸系 `a1`
 * - 三軸系 `b` と四軸系 `a2`
 */
function expandAxisGuideAliases(baseLabel) {
  switch (baseLabel) {
    case "a":
      return ["a", "a1"];
    case "a1":
      return ["a1", "a"];
    case "b":
      return ["b", "a2"];
    case "a2":
      return ["a2", "b"];
    case "a3":
      return ["a3"];
    case "c":
      return ["c"];
    default:
      return [baseLabel];
  }
}

/** 結晶系ごとに表示すべき基準方向候補ラベル一覧を返す。 */
export function getAvailableContactReferenceAxisLabels(
  systemId: CrystalSystemId | string,
) {
  return usesFourAxisMiller(systemId)
    ? [...FOUR_AXIS_CONTACT_REFERENCE_LABELS]
    : [...THREE_AXIS_CONTACT_REFERENCE_LABELS];
}

/** 保存値を現在の結晶系で有効な基準方向ラベルへ正規化する。 */
export function normalizeContactReferenceAxisLabel(
  axisLabel: unknown,
  systemId: CrystalSystemId | string,
) {
  if (axisLabel == null || axisLabel === "") {
    return null;
  }
  const normalized = String(axisLabel).trim();
  return getAvailableContactReferenceAxisLabels(systemId).includes(normalized)
    ? normalized
    : null;
}

/**
 * 選択された基準方向ラベルから、接触面内回転の比較に使う単位ベクトルを解決する。
 *
 * 入力:
 * - preview 用に計算済みの axis guide 群
 * - `a`, `-a2`, `c` などのラベル
 *
 * 出力:
 * - 対応する方向ベクトル
 * - 解決不能な場合は `null`
 */
export function resolveContactReferenceAxisDirection(axisGuides, axisLabel) {
  const { sign, baseLabel } = splitSignedAxisLabel(axisLabel);
  if (!baseLabel) {
    return null;
  }

  for (const label of expandAxisGuideAliases(baseLabel)) {
    const axis = (axisGuides ?? []).find(
      (candidate) => candidate.label === label,
    );
    if (!axis) {
      continue;
    }
    const direction = new THREE.Vector3(
      axis.end.x - axis.start.x,
      axis.end.y - axis.start.y,
      axis.end.z - axis.start.z,
    );
    if (direction.lengthSq() > 0) {
      return direction.normalize().multiplyScalar(sign);
    }
  }

  return null;
}

/**
 * 接触双晶の「基準方向」選択肢と、実際の軸ベクトル解決を担当する。
 *
 * 接触面法線を合わせたあとに残る面内回転を決めるための補助であり、
 * UI 表示用ラベルの列挙と builder 用の方向ベクトル解決を同じ規則で扱う。
 */
