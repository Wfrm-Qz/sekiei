import * as THREE from "three";

/**
 * 色生成と係数スピン補助をまとめる。
 *
 * 面グループ色、結晶ごとの accent 色、タブ / テーブルの派生色は
 * プレビューと面一覧の見た目を安定させるため同じ規則で作る。
 */

/** Three.Color を CSS 用 rgba 文字列へ変換する。 */
export function colorToRgbaString(color, alpha) {
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

/** 保存済み accent 色が妥当なら返し、壊れた値は null に寄せる。 */
export function normalizeCrystalAccentColor(value) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
}

/** 面ごとの明示色も #RRGGBB 形式で正規化する。 */
export function normalizeFaceAccentColor(value) {
  return normalizeCrystalAccentColor(value);
}

/** face group 色生成用の安定 hash を作る。 */
export function hashFaceGroupKey(groupKey) {
  let hash = 2166136261;
  const source = String(groupKey);
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** groupKey を数値列へ分解し、色生成のばらしに使う。 */
export function parseFaceGroupKeyValues(groupKey) {
  return String(groupKey)
    .split("::")
    .flatMap((faceKey) => faceKey.split("|"))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
}

/** 色生成用に 10 で巡回する値へ正規化する。 */
export function normalizeModuloTen(value) {
  const remainder = Number(value) % 10;
  return Object.is(remainder, -0) ? 0 : remainder;
}

/** 結晶色と面一覧背景色で共通利用する group 色を作る。 */
export function createFaceGroupColor(groupKey) {
  const values = parseFaceGroupKeyValues(groupKey);
  const hash = hashFaceGroupKey(groupKey);
  const moduloValues = values.map(normalizeModuloTen);
  let hueAccumulator = 0;
  let saturationAccumulator = 0;
  let lightnessAccumulator = 0;

  values.forEach((value, index) => {
    const offset = value + 101;
    hueAccumulator += offset * (index * 67 + 29);
    saturationAccumulator += (Math.abs(value) + 1) * (index * 19 + 11);
    lightnessAccumulator +=
      (value * value + Math.abs(value) * 13 + 17) * (index * 13 + 7);
  });

  let moduloSaturationAccumulator = 0;
  let moduloLightnessAccumulator = 0;
  moduloValues.forEach((value, index) => {
    moduloSaturationAccumulator += (value + 10) * (index * 31 + 19);
    moduloLightnessAccumulator += (10 - value) * (index * 37 + 23);
  });

  const hashHue =
    ((hash % 360) + ((hash >>> 8) % 360) * 0.7 + ((hash >>> 16) % 360) * 0.35) %
    360;
  const numericHueOffset =
    ((hueAccumulator % 43) +
      (saturationAccumulator % 17) +
      (lightnessAccumulator % 11)) %
    48;
  const hue = (hashHue + numericHueOffset) % 360;
  const saturation = Math.min(
    0.98,
    0.32 + (moduloSaturationAccumulator % 52) / 100 + ((hash >>> 7) % 14) / 100,
  );
  const lightness = Math.min(
    0.82,
    0.12 + (moduloLightnessAccumulator % 58) / 100 + ((hash >>> 17) % 12) / 100,
  );
  const previewColor = new THREE.Color().setHSL(
    hue / 360,
    saturation,
    lightness,
  );
  const backgroundColor = previewColor.clone();
  const borderColor = previewColor
    .clone()
    .lerp(new THREE.Color(0xffffff), 0.15);

  return {
    preview: `#${previewColor.getHexString()}`,
    background: colorToRgbaString(backgroundColor, 0.36),
    border: colorToRgbaString(borderColor, 0.5),
  };
}

/** 明示指定された hex 色から face group 相当の preview/background/border を作る。 */
export function createFaceColorSetFromHex(colorHex) {
  const normalized = normalizeFaceAccentColor(colorHex);
  const previewColor = new THREE.Color(normalized ?? "#d1b36a");
  const backgroundColor = previewColor.clone();
  const borderColor = previewColor
    .clone()
    .lerp(new THREE.Color(0xffffff), 0.15);

  return {
    preview: `#${previewColor.getHexString()}`,
    background: colorToRgbaString(backgroundColor, 0.36),
    border: colorToRgbaString(borderColor, 0.5),
  };
}

/** 結晶 index に対応する accent 色を返す。custom 色があればそちらを優先する。 */
export function getCrystalAccentColor(index, customAccentColor = null) {
  const normalizedCustomAccentColor =
    normalizeCrystalAccentColor(customAccentColor);
  if (normalizedCustomAccentColor) {
    return normalizedCustomAccentColor;
  }
  const accents = [0xd35b53, 0x4e77d8, 0x2f8f63, 0xc08a2d, 0x905ead, 0x3d8b9a];
  return accents[index % accents.length];
}

/** 結晶 tab / テーブル背景で使う派生色セットを返す。 */
export function createCrystalUiColors(index, customAccentColor = null) {
  const accent = new THREE.Color(
    getCrystalAccentColor(index, customAccentColor),
  );
  const border = accent.clone().lerp(new THREE.Color(0xffffff), 0.2);
  const opaqueTableHead = accent.clone().lerp(new THREE.Color(0xffffff), 0.78);
  return {
    tabBackground: colorToRgbaString(accent, 0.2),
    tabHoverBackground: colorToRgbaString(accent, 0.28),
    tabActiveBackground: colorToRgbaString(accent, 0.34),
    tabBorder: colorToRgbaString(border, 0.55),
    tableBackground: colorToRgbaString(accent, 0.22),
    tableHeadBackground: colorToRgbaString(opaqueTableHead, 1),
  };
}
