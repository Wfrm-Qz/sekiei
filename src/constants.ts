import { createDefaultFacesForSystem } from "./domain/faces.js";

/**
 * 結晶パラメーター全体で共有する façade module。
 *
 * 既存 import 互換を保つため入口は `constants.ts` に残しつつ、
 * 実体は `domain/crystalSystems.ts` と `domain/faces.ts` へ責務別に分離している。
 */
/** 日本語名 / 英語名を持つローカライズ済み名称。 */
export interface LocalizedName {
  en: string;
  jp: string;
}

/** 新規 JSON / 新規画面で使う既定の結晶名。 */
export const DEFAULT_LOCALIZED_NAME: LocalizedName = Object.freeze({
  en: "Cube",
  jp: "立方体",
});

/** 名称未設定時に使う空の fallback。 */
const EMPTY_LOCALIZED_NAME: LocalizedName = Object.freeze({
  en: "",
  jp: "",
});

/** 新規結晶パラメーター一式を返す。 */
export function createDefaultParameters() {
  return {
    version: 1,
    presetId: "cube-00001",
    name: structuredClone(DEFAULT_LOCALIZED_NAME),
    shortDescription: "",
    description: "",
    reference: "",
    fullReference: "",
    crystalSystem: "cubic",
    axes: { a: 1, b: 1, c: 1 },
    angles: { alpha: 90, beta: 90, gamma: 90 },
    sizeMm: 50,
    faces: createDefaultFacesForSystem("cubic"),
  };
}

/**
 * 生の `name` 値を `{ en, jp }` 形式へ正規化する。
 *
 * 旧 JSON は文字列 1 本、移行後は object なので両方を受けられるようにしている。
 */
export function normalizeLocalizedName(
  raw: unknown,
  fallback: LocalizedName | string = EMPTY_LOCALIZED_NAME,
): LocalizedName {
  const fallbackName =
    fallback && typeof fallback === "object"
      ? {
          en: typeof fallback.en === "string" ? fallback.en : "",
          jp: typeof fallback.jp === "string" ? fallback.jp : "",
        }
      : {
          en: typeof fallback === "string" ? fallback : "",
          jp: typeof fallback === "string" ? fallback : "",
        };

  if (typeof raw === "string") {
    return {
      en: raw,
      jp: raw,
    };
  }

  if (raw && typeof raw === "object") {
    const localizedRaw = raw as Partial<LocalizedName>;
    const en =
      typeof localizedRaw.en === "string"
        ? localizedRaw.en
        : typeof localizedRaw.jp === "string"
          ? localizedRaw.jp
          : fallbackName.en;
    const jp =
      typeof localizedRaw.jp === "string"
        ? localizedRaw.jp
        : typeof localizedRaw.en === "string"
          ? localizedRaw.en
          : fallbackName.jp;
    return { en, jp };
  }

  return fallbackName;
}

/**
 * 現在言語向けの結晶名を取り出す。
 *
 * `ja` は内部では `jp` キーへ寄せて扱う。片方が空ならもう片方へ fallback する。
 */
export function getLocalizedNameText(
  raw: unknown,
  preferredLocale = "jp",
  fallback: LocalizedName | string = EMPTY_LOCALIZED_NAME,
) {
  const normalized = normalizeLocalizedName(raw, fallback);
  const normalizedPreferredLocale =
    preferredLocale === "ja" ? "jp" : preferredLocale === "jp" ? "jp" : "en";
  const preferred = normalized[normalizedPreferredLocale];
  if (typeof preferred === "string" && preferred.trim().length > 0) {
    return preferred;
  }
  const alternateLocale = normalizedPreferredLocale === "jp" ? "en" : "jp";
  const alternate = normalized[alternateLocale];
  if (typeof alternate === "string" && alternate.trim().length > 0) {
    return alternate;
  }
  return "";
}

export {
  CRYSTAL_SYSTEMS,
  type CrystalSystemId,
  SYSTEM_FIELD_RULES,
  applyCrystalSystemConstraints,
  getCrystalSystemLabel,
  isFieldLocked,
  usesFourAxisMiller,
} from "./domain/crystalSystems.js";

export {
  FACE_TEXT_DEFAULTS,
  createDefaultFacesForSystem,
  createEquivalentFaces,
  createFace,
  createMissingEquivalentFaces,
  getEquivalentFaceGroupKey,
  normalizeFaceForSystem,
} from "./domain/faces.js";
