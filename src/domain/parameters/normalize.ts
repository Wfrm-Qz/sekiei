import {
  applyCrystalSystemConstraints,
  createFace,
  normalizeFaceForSystem,
  usesFourAxisMiller,
} from "../../constants.js";
import { normalizeContactReferenceAxisLabel } from "../contactReferenceAxis.js";
import {
  JSON_IMPORT_LIMITS,
  normalizeParameters,
} from "../../io/parameters.js";
import { normalizeFaceAccentColor } from "../../state/colorHelpers.js";
import {
  convertTwinDocumentV2ToLegacyShape,
  createTwinImportError,
  isPlainRecord,
  isTwinDocumentV2,
  validateTwinImportShape,
} from "./compatV1.js";
import {
  createDefaultTwinParameters,
  type TwinBlockParameters as TwinBlockShape,
  type TwinCrystalParameters as TwinCrystalShape,
  type TwinType,
  twinRuleTypeForTwinType,
} from "./defaults.js";

/**
 * 双晶 parameter の normalize / import 互換責務。
 *
 * 旧 schema と v2 document schema の両方を読み込み、現行 runtime が扱う
 * twin parameter 形状へ正規化する。
 */

/** 数値化できない値を安全に fallback へ寄せる。 */
function toNumber(value: unknown, fallback: number) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** 結晶 accent 色を #RRGGBB へ揃え、壊れた値は null に寄せる。 */
function normalizeAccentColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed : null;
}

/** 結晶ごとの一意 id を作る。 */
function createCrystalId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `crystal-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/** 結晶系ごとの既定双晶軸指数を返す。 */
function getDefaultTwinAxisIndexes(systemId: string) {
  if (usesFourAxisMiller(systemId)) {
    return { h: 0, k: 1, i: -1, l: 0 };
  }
  return { h: 1, k: 1, l: 1 };
}

/** 双晶軸 / 双晶面指数を結晶系向けに正規化する。 */
function normalizeRuleIndexes(
  raw: Record<string, unknown> | undefined,
  systemId: string,
) {
  return normalizeFaceForSystem(
    createFace({
      h: toNumber(raw?.h, 0),
      k: toNumber(raw?.k, 0),
      i: toNumber(raw?.i, 0),
      l: toNumber(raw?.l, 1),
      coefficient: 1,
    }),
    systemId,
  );
}

/** 結晶ごとの面一覧を正規化する。面 id と enabled もここで補う。 */
function normalizeFaces(
  rawFaces: unknown,
  systemId: string,
  fallbackFaces: unknown,
): ReturnType<typeof createFace>[] {
  if (!Array.isArray(rawFaces)) {
    return structuredClone(
      (fallbackFaces as ReturnType<typeof createFace>[]) ?? [],
    );
  }

  return rawFaces.map((face) =>
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
        h: toNumber(face?.h, 1),
        k: toNumber(face?.k, 0),
        i: toNumber(face?.i, -1),
        l: toNumber(face?.l, 0),
        coefficient: toNumber(face?.coefficient, 1),
        enabled: typeof face?.enabled === "boolean" ? face.enabled : true,
        accentColor: normalizeFaceAccentColor(face?.accentColor),
        text: face?.text,
      }),
      systemId,
    ),
  );
}

/** face id 参照が壊れたとき用の fallback 面参照を返す。 */
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

/** 保存値の face ref を、現在の face 配列に存在する id へ正規化する。 */
function normalizeFaceRef(
  rawRef: unknown,
  faces: { id?: string | null }[] | undefined,
  fallbackIndex = 0,
) {
  if (!Array.isArray(faces) || faces.length === 0) {
    return null;
  }

  if (typeof rawRef === "string") {
    return faces.some((face) => face.id === rawRef)
      ? rawRef
      : fallbackFaceRef(faces, fallbackIndex);
  }

  const numeric = Number(rawRef);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < faces.length) {
    return faces[numeric]?.id ?? fallbackFaceRef(faces, fallbackIndex);
  }

  return fallbackFaceRef(faces, fallbackIndex);
}

/** 結晶 1 個分の定義を正規化する。 */
function normalizeCrystalDefinition(
  rawCrystal: Record<string, unknown> | undefined,
  systemId: string,
  fallbackFaces: unknown,
  fallbackSourceFaces: unknown,
  fallbackRole: string,
  fallbackIndex: number,
): TwinCrystalShape {
  const faces = normalizeFaces(rawCrystal?.faces, systemId, fallbackFaces);
  const sourceFaces = normalizeFaces(
    fallbackSourceFaces,
    systemId,
    fallbackSourceFaces,
  );
  const rawContact = isPlainRecord(rawCrystal?.contact)
    ? rawCrystal.contact
    : {};
  const twinType: TwinCrystalShape["twinType"] =
    rawCrystal?.twinType === "contact" || rawCrystal?.twinType === "penetration"
      ? rawCrystal.twinType
      : "penetration";
  return {
    id: typeof rawCrystal?.id === "string" ? rawCrystal.id : createCrystalId(),
    accentColor: normalizeAccentColor(rawCrystal?.accentColor),
    role: typeof rawCrystal?.role === "string" ? rawCrystal.role : fallbackRole,
    from: Math.max(0, Math.trunc(toNumber(rawCrystal?.from, fallbackIndex))),
    enabled:
      typeof rawCrystal?.enabled === "boolean" ? rawCrystal.enabled : true,
    twinType,
    ruleType: twinRuleTypeForTwinType(twinType),
    plane: normalizeRuleIndexes(
      (rawCrystal?.plane as Record<string, unknown> | undefined) ?? {
        h: 1,
        k: 1,
        l: 1,
      },
      systemId,
    ),
    axis: normalizeRuleIndexes(
      (rawCrystal?.axis as Record<string, unknown> | undefined) ??
        getDefaultTwinAxisIndexes(systemId),
      systemId,
    ),
    rotationAngleDeg: toNumber(rawCrystal?.rotationAngleDeg, 60),
    contact: {
      baseFaceRef: normalizeFaceRef(rawContact.baseFaceRef, sourceFaces, 0),
      derivedFaceRef: normalizeFaceRef(rawContact.derivedFaceRef, faces, 0),
      referenceAxisLabel: normalizeContactReferenceAxisLabel(
        rawContact.referenceAxisLabel,
        systemId,
      ),
    },
    faces,
  };
}

/** 新規双晶の初期状態として使う base / derived 2 結晶を作る。 */
function buildDefaultTwinCrystals(
  baseFaces: unknown,
  crystalSystem: string,
): TwinCrystalShape[] {
  const baseCrystalFaces = normalizeFaces(baseFaces, crystalSystem, baseFaces);
  const derivedCrystalFaces = normalizeFaces(
    baseFaces,
    crystalSystem,
    baseFaces,
  );
  return [
    {
      id: createCrystalId(),
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

/** `raw.twin` ブロック全体を正規化する。 */
function normalizeTwinBlock(
  rawTwin: Record<string, unknown> | undefined,
  systemId: string,
  baseFaces: unknown,
): TwinBlockShape {
  const base = createDefaultTwinParameters().twin;
  const rawContact = isPlainRecord(rawTwin?.contact) ? rawTwin.contact : {};
  const defaultCrystals = buildDefaultTwinCrystals(baseFaces, systemId);
  const rawCrystals = Array.isArray(rawTwin?.crystals) ? rawTwin.crystals : [];
  const crystalCount = Math.max(rawCrystals.length, 1);
  const crystals: TwinCrystalShape[] = [];

  for (let index = 0; index < crystalCount; index += 1) {
    const fallbackCrystal = defaultCrystals[index] ?? {
      ...defaultCrystals[1],
      id: createCrystalId(),
      from: Math.max(0, index - 1),
      faces: normalizeFaces(
        defaultCrystals[Math.max(0, index - 1)]?.faces ?? baseFaces,
        systemId,
        baseFaces,
      ),
    };
    const fallbackSourceFaces =
      fallbackCrystal.from === 0
        ? (crystals[0]?.faces ?? defaultCrystals[0]?.faces ?? baseFaces)
        : (crystals[fallbackCrystal.from]?.faces ??
          defaultCrystals[fallbackCrystal.from]?.faces ??
          baseFaces);
    crystals.push(
      normalizeCrystalDefinition(
        rawCrystals[index] as Record<string, unknown> | undefined,
        systemId,
        fallbackCrystal.faces,
        fallbackSourceFaces,
        index === 0 ? "base" : "derived",
        fallbackCrystal.from,
      ),
    );
  }

  const twinType: TwinType =
    rawTwin?.type === "contact" || rawTwin?.type === "penetration"
      ? rawTwin.type
      : base.type;

  return {
    enabled: Boolean(rawTwin?.enabled),
    type: twinType,
    ruleType: twinRuleTypeForTwinType(twinType),
    plane: normalizeRuleIndexes(
      (rawTwin?.plane as Record<string, unknown> | undefined) ??
        (base.plane as Record<string, unknown>),
      systemId,
    ),
    axis: normalizeRuleIndexes(
      (rawTwin?.axis as Record<string, unknown> | undefined) ??
        (base.axis as Record<string, unknown>),
      systemId,
    ),
    rotationAngleDeg: toNumber(
      rawTwin?.rotationAngleDeg,
      base.rotationAngleDeg,
    ),
    contact: {
      baseFaceRef: normalizeFaceRef(
        rawContact.baseFaceRef,
        crystals[0]?.faces ?? [],
        0,
      ),
      derivedFaceRef: normalizeFaceRef(
        rawContact.derivedFaceRef,
        crystals[1]?.faces ?? [],
        0,
      ),
    },
    crystals,
  };
}

export { validateTwinImportShape } from "./compatV1.js";

/** 双晶 parameter を現行 runtime 形状へ正規化する。 */
export function normalizeTwinParameters(raw: unknown) {
  const normalizedRaw =
    isTwinDocumentV2(raw) && isPlainRecord(raw)
      ? convertTwinDocumentV2ToLegacyShape(raw)
      : raw;
  const baseParameters = normalizeParameters(normalizedRaw);
  const next = applyCrystalSystemConstraints({
    ...createDefaultTwinParameters(),
    ...baseParameters,
  }) as ReturnType<typeof createDefaultTwinParameters> & {
    twin: TwinBlockShape;
  };

  const normalizedTwin = normalizedRaw as Record<string, unknown> | undefined;
  const rawTwin = isPlainRecord(normalizedTwin?.twin)
    ? normalizedTwin.twin
    : null;
  const rawTwinCrystals = Array.isArray(rawTwin?.crystals)
    ? rawTwin.crystals
    : [];
  const baseFaceSource =
    Array.isArray(rawTwinCrystals[0]?.faces) &&
    rawTwinCrystals[0].faces.length > 0
      ? rawTwinCrystals[0].faces
      : normalizedTwin?.faces;
  next.faces = normalizeFaces(
    baseFaceSource,
    next.crystalSystem,
    next.faces,
  ).map((face) => normalizeFaceForSystem(face, next.crystalSystem));

  next.mode = "twin";
  next.twin = normalizeTwinBlock(rawTwin, next.crystalSystem, next.faces);
  next.twin.enabled =
    typeof rawTwin?.enabled === "boolean"
      ? rawTwin.enabled
      : normalizedTwin?.mode === "twin";
  if (next.twin.enabled && next.twin.crystals.length < 2) {
    const defaultDerived = buildDefaultTwinCrystals(
      next.faces,
      next.crystalSystem,
    )[1];
    next.twin.crystals.push({
      ...defaultDerived,
      faces: normalizeFaces(
        defaultDerived.faces,
        next.crystalSystem,
        next.faces,
      ).map((face) => normalizeFaceForSystem(face, next.crystalSystem)),
    });
  }
  next.twin.ruleType = twinRuleTypeForTwinType(next.twin.type);
  next.twin.plane = normalizeRuleIndexes(next.twin.plane, next.crystalSystem);
  next.twin.axis = normalizeRuleIndexes(next.twin.axis, next.crystalSystem);
  next.twin.crystals = next.twin.crystals.map((crystal, index) => {
    const fromIndex =
      index === 0
        ? 0
        : Math.max(
            0,
            Math.min(Math.trunc(toNumber(crystal.from, 0)), index - 1),
          );
    const fallbackFaces =
      fromIndex === 0
        ? next.faces
        : (next.twin.crystals[fromIndex]?.faces ?? next.faces);
    const faces = normalizeFaces(
      crystal.faces,
      next.crystalSystem,
      fallbackFaces,
    ).map((face) => normalizeFaceForSystem(face, next.crystalSystem));

    return {
      ...crystal,
      accentColor: normalizeAccentColor(crystal.accentColor),
      from: fromIndex,
      role: index === 0 ? "base" : "derived",
      enabled: index === 0 ? true : crystal.enabled !== false,
      twinType:
        index === 0
          ? "penetration"
          : crystal.twinType === "contact" || crystal.twinType === "penetration"
            ? crystal.twinType
            : "penetration",
      ruleType:
        index === 0 ? "axis" : twinRuleTypeForTwinType(crystal.twinType),
      plane: normalizeRuleIndexes(crystal.plane, next.crystalSystem),
      axis: normalizeRuleIndexes(crystal.axis, next.crystalSystem),
      rotationAngleDeg: toNumber(crystal.rotationAngleDeg, 60),
      contact: {
        baseFaceRef: normalizeFaceRef(
          crystal.contact?.baseFaceRef,
          next.twin.crystals[fromIndex]?.faces ?? next.faces,
          0,
        ),
        derivedFaceRef: normalizeFaceRef(
          crystal.contact?.derivedFaceRef,
          faces,
          0,
        ),
        referenceAxisLabel: normalizeContactReferenceAxisLabel(
          crystal.contact?.referenceAxisLabel,
          next.crystalSystem,
        ),
      },
      faces,
    };
  });
  next.faces = structuredClone(next.twin.crystals[0]?.faces ?? next.faces);
  next.twin.contact.baseFaceRef = normalizeFaceRef(
    next.twin.contact.baseFaceRef,
    next.twin.crystals[0]?.faces ?? [],
    0,
  );
  next.twin.contact.derivedFaceRef = normalizeFaceRef(
    next.twin.contact.derivedFaceRef,
    next.twin.crystals[1]?.faces ?? [],
    0,
  );
  next.twin.type =
    (next.twin.crystals[1]?.twinType as TwinBlockShape["type"] | undefined) ??
    next.twin.type;
  next.twin.ruleType = twinRuleTypeForTwinType(next.twin.type);
  next.twin.axis = normalizeRuleIndexes(
    next.twin.crystals[1]?.axis ?? next.twin.axis,
    next.crystalSystem,
  );
  next.twin.plane = normalizeRuleIndexes(
    next.twin.crystals[1]?.plane ?? next.twin.plane,
    next.crystalSystem,
  );
  next.twin.rotationAngleDeg = toNumber(
    next.twin.crystals[1]?.rotationAngleDeg,
    next.twin.rotationAngleDeg,
  );
  next.twin.contact = {
    baseFaceRef:
      next.twin.crystals[1]?.contact?.baseFaceRef ??
      next.twin.contact.baseFaceRef,
    derivedFaceRef:
      next.twin.crystals[1]?.contact?.derivedFaceRef ??
      next.twin.contact.derivedFaceRef,
  };

  return next;
}

/** 双晶 JSON 文字列を parse / 検証してから正規化する。 */
export function readTwinParametersContent(content: string) {
  const parsed = JSON.parse(content);
  validateTwinImportShape(parsed);
  return normalizeTwinParameters(parsed);
}

/** 双晶 JSON ファイルをサイズ上限付きで読み込み、正規化済み parameter を返す。 */
export async function readTwinParametersFile(file: File) {
  if (file.size > JSON_IMPORT_LIMITS.maxFileSizeBytes) {
    throw createTwinImportError(
      `JSON ファイルが大きすぎます。上限は ${Math.round(
        JSON_IMPORT_LIMITS.maxFileSizeBytes / 1024,
      )} KB です。`,
    );
  }
  const content = await file.text();
  return readTwinParametersContent(content);
}
