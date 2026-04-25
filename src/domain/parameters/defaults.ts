import {
  createDefaultParameters,
  createFace,
  normalizeFaceForSystem,
  usesFourAxisMiller,
} from "../../constants.js";
import { normalizeFaceAccentColor } from "../../state/colorHelpers.js";

export type TwinType = "penetration" | "contact";
export type TwinRuleType = "axis" | "plane";

export interface TwinCrystalParameters {
  id: string;
  accentColor?: string | null;
  role: string;
  from: number;
  enabled: boolean;
  twinType: TwinType;
  ruleType: TwinRuleType;
  plane: ReturnType<typeof normalizeRuleIndexes>;
  axis: ReturnType<typeof normalizeRuleIndexes>;
  rotationAngleDeg: number;
  contact: {
    baseFaceRef: string | null;
    derivedFaceRef: string | null;
    referenceAxisLabel: string | null;
  };
  faces: ReturnType<typeof normalizeFaces>;
}

export interface TwinBlockParameters {
  enabled: boolean;
  type: TwinType;
  ruleType: TwinRuleType;
  plane: ReturnType<typeof normalizeRuleIndexes>;
  axis: ReturnType<typeof normalizeRuleIndexes>;
  rotationAngleDeg: number;
  contact: {
    baseFaceRef: string | null;
    derivedFaceRef: string | null;
  };
  crystals: TwinCrystalParameters[];
}

export interface TwinParameters extends ReturnType<
  typeof createDefaultParameters
> {
  mode: "twin";
  twin: TwinBlockParameters;
}

/**
 * 双晶 parameter の既定値責務。
 *
 * 新規 document 作成時の twin rule 既定値と、base / derived の初期 crystal 構成を
 * ここでまとめて管理する。
 */

/** 双晶タイプから ruleType を決める。接触双晶は常に plane 基準になる。 */
export function twinRuleTypeForTwinType(twinType: string) {
  return twinType === "contact" ? "plane" : "axis";
}

/** 結晶系ごとの既定双晶軸指数を返す。 */
function getDefaultTwinAxisIndexes(systemId: string) {
  if (usesFourAxisMiller(systemId)) {
    return { h: 0, k: 1, i: -1, l: 0 };
  }
  return { h: 1, k: 1, l: 1 };
}

/** 結晶ごとの一意 id を作る。 */
function createCrystalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `crystal-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/** 双晶軸 / 双晶面指数を結晶系向けに正規化する。 */
function normalizeRuleIndexes(
  raw: { h?: number; k?: number; i?: number; l?: number } | undefined,
  systemId: string,
) {
  return normalizeFaceForSystem(
    createFace({
      h: Number(raw?.h ?? 0),
      k: Number(raw?.k ?? 0),
      i: Number(raw?.i ?? 0),
      l: Number(raw?.l ?? 1),
      coefficient: 1,
    }),
    systemId,
  );
}

/** fallback 用の face id を返す。 */
function fallbackFaceRef(
  faces: { id?: string | null }[] | undefined,
  fallbackIndex = 0,
) {
  if (!Array.isArray(faces) || faces.length === 0) {
    return null;
  }
  const safeIndex = Math.max(0, Math.min(fallbackIndex, faces.length - 1));
  return faces[safeIndex]?.id ?? faces[0]?.id ?? null;
}

/** 面一覧を現在の結晶系へ揃えつつ、id と enabled を補う。 */
function normalizeFaces(
  rawFaces: Record<string, unknown>[] | undefined,
  systemId: string,
  fallbackFaces: Record<string, unknown>[] | undefined,
): ReturnType<typeof createFace>[] {
  const sourceFaces = Array.isArray(rawFaces)
    ? rawFaces
    : Array.isArray(fallbackFaces)
      ? fallbackFaces
      : [];

  return sourceFaces.map((face) =>
    normalizeFaceForSystem(
      createFace({
        ...(typeof face?.id === "string" ? { id: face.id } : {}),
        ...(typeof face?.draftGroupKey === "string"
          ? { draftGroupKey: face.draftGroupKey }
          : {}),
        ...(Array.isArray(face?.draftEmptyFields)
          ? {
              draftEmptyFields: face.draftEmptyFields.filter((field) =>
                ["h", "k", "l", "coefficient"].includes(String(field)),
              ),
            }
          : {}),
        h: Number(face?.h ?? 1),
        k: Number(face?.k ?? 0),
        i: Number(face?.i ?? -1),
        l: Number(face?.l ?? 0),
        coefficient: Number(face?.coefficient ?? 1),
        enabled: typeof face?.enabled === "boolean" ? face.enabled : true,
        accentColor: normalizeFaceAccentColor(face?.accentColor),
        text: face?.text,
      }),
      systemId,
    ),
  );
}

/** 新規双晶の初期状態として使う base / derived 2 結晶を作る。 */
function buildDefaultTwinCrystals(
  baseFaces: Record<string, unknown>[],
  crystalSystem: string,
): TwinCrystalParameters[] {
  const baseCrystalFaces = normalizeFaces(baseFaces, crystalSystem, baseFaces);
  const derivedCrystalFaces = normalizeFaces(
    baseFaces,
    crystalSystem,
    baseFaces,
  );
  return [
    {
      id: createCrystalId(),
      accentColor: null,
      role: "base",
      from: 0,
      enabled: true,
      twinType: "penetration",
      ruleType: "axis",
      plane: normalizeRuleIndexes({ h: 1, k: 1, l: 1 }, crystalSystem),
      axis: normalizeRuleIndexes(
        getDefaultTwinAxisIndexes(crystalSystem),
        crystalSystem,
      ),
      rotationAngleDeg: 60,
      contact: {
        baseFaceRef: fallbackFaceRef(baseCrystalFaces, 0),
        derivedFaceRef: fallbackFaceRef(baseCrystalFaces, 0),
        referenceAxisLabel: null,
      },
      faces: baseCrystalFaces,
    },
    {
      id: createCrystalId(),
      accentColor: null,
      role: "derived",
      from: 0,
      enabled: true,
      twinType: "penetration",
      ruleType: "axis",
      plane: normalizeRuleIndexes({ h: 1, k: 1, l: 1 }, crystalSystem),
      axis: normalizeRuleIndexes(
        getDefaultTwinAxisIndexes(crystalSystem),
        crystalSystem,
      ),
      rotationAngleDeg: 60,
      contact: {
        baseFaceRef: fallbackFaceRef(baseCrystalFaces, 0),
        derivedFaceRef: fallbackFaceRef(derivedCrystalFaces, 1),
        referenceAxisLabel: null,
      },
      faces: derivedCrystalFaces,
    },
  ];
}

/** 新規双晶 parameter 一式を返す。 */
export function createDefaultTwinParameters(): TwinParameters {
  const base = createDefaultParameters();
  const crystals = buildDefaultTwinCrystals(base.faces, base.crystalSystem);
  return {
    ...base,
    faces: structuredClone(crystals[0].faces),
    mode: "twin" as const,
    twin: {
      enabled: false,
      type: "penetration" as const,
      ruleType: "axis" as const,
      plane: normalizeRuleIndexes({ h: 1, k: 1, l: 1 }, base.crystalSystem),
      axis: normalizeRuleIndexes(
        getDefaultTwinAxisIndexes(base.crystalSystem),
        base.crystalSystem,
      ),
      rotationAngleDeg: 60,
      contact: {
        baseFaceRef: fallbackFaceRef(crystals[0].faces, 0),
        derivedFaceRef: null,
      },
      crystals: [crystals[0]],
    },
  };
}

/** 結晶系ごとの既定双晶軸 rule を単体で返す。 */
export function createDefaultTwinAxisRule(systemId: string) {
  return normalizeRuleIndexes(getDefaultTwinAxisIndexes(systemId), systemId);
}
