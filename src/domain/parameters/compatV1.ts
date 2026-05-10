import {
  JSON_IMPORT_LIMITS,
  validateParameterImportShape,
} from "../../io/parameters.js";
import { twinRuleTypeForTwinType } from "./defaults.js";
import { isSupportedTwinParametersDocumentSchema } from "./schemaNames.js";

/**
 * 双晶 JSON の旧 schema / v2 schema 互換読込と実行時検証を扱う。
 *
 * normalize 本体から互換層を分離し、通常の runtime 正規化と
 * 旧構造吸収ロジックを別ファイルで保守できるようにする。
 */

/** object 前提の JSON かどうかを確認する。 */
export function isPlainRecord(
  value: unknown,
): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 双晶 import エラーを短い文で表す。 */
export function createTwinImportError(message: string) {
  return new Error(message);
}

/** `crystals[]` 主体の新 schema かどうかを判定する。 */
export function isTwinDocumentV2(raw: unknown) {
  return (
    isPlainRecord(raw) &&
    raw.version === 2 &&
    isSupportedTwinParametersDocumentSchema(raw.schema) &&
    Array.isArray(raw.crystals)
  );
}

/** 新 schema の metadata を旧 root field 互換の形で取り出す。 */
export function getTwinDocumentMetadata(raw: Record<string, unknown>) {
  if (!isPlainRecord(raw?.metadata)) {
    return {
      shortDescription: "",
      description: "",
      reference: "",
      fullReference: "",
    };
  }
  return {
    shortDescription:
      typeof raw.metadata.shortDescription === "string"
        ? raw.metadata.shortDescription
        : "",
    description:
      typeof raw.metadata.description === "string"
        ? raw.metadata.description
        : "",
    reference:
      typeof raw.metadata.reference === "string" ? raw.metadata.reference : "",
    fullReference:
      typeof raw.metadata.fullReference === "string"
        ? raw.metadata.fullReference
        : "",
  };
}

/** 新 schema の `from` を現在の crystal 配列 index に解決する。 */
function resolveCrystalSourceIndex(
  rawFrom: unknown,
  crystals: unknown[],
  fallbackIndex: number,
) {
  if (typeof rawFrom === "string") {
    const matchedIndex = crystals.findIndex(
      (crystal) => (crystal as Record<string, unknown>)?.id === rawFrom,
    );
    return matchedIndex >= 0 ? matchedIndex : fallbackIndex;
  }
  if (
    typeof rawFrom === "number" &&
    Number.isInteger(rawFrom) &&
    rawFrom >= 0
  ) {
    return rawFrom;
  }
  return fallbackIndex;
}

/** 保存案の揺れを吸収し、正式な `offsets` 配列を優先して読む。 */
function readRawTwinOffsets(raw: Record<string, unknown> | null | undefined) {
  if (Array.isArray(raw?.offsets)) {
    return raw.offsets;
  }
  if (Array.isArray(raw?.offset)) {
    return raw.offset;
  }
  return undefined;
}

/** 新 schema document を旧互換 shape へ落とす。 */
export function convertTwinDocumentV2ToLegacyShape(
  raw: Record<string, unknown>,
) {
  const metadata = getTwinDocumentMetadata(raw);
  const rawCrystals = Array.isArray(raw.crystals) ? raw.crystals : [];
  const normalizedCrystals = rawCrystals.map((crystal, index) => {
    const crystalRecord = isPlainRecord(crystal) ? crystal : {};
    const placement = isPlainRecord(crystalRecord.placement)
      ? crystalRecord.placement
      : null;
    const rule = isPlainRecord(placement?.rule) ? placement.rule : null;
    const offsets =
      readRawTwinOffsets(placement) ?? readRawTwinOffsets(crystalRecord) ?? [];
    const resolvedTwinType =
      placement?.type === "contact" || placement?.type === "penetration"
        ? placement.type
        : "penetration";
    const resolvedRuleType =
      rule?.kind === "axis" || rule?.kind === "plane"
        ? rule.kind
        : twinRuleTypeForTwinType(resolvedTwinType);
    return {
      id:
        typeof crystalRecord.id === "string"
          ? crystalRecord.id
          : `compat-crystal-${index}`,
      accentColor:
        typeof crystalRecord.accentColor === "string"
          ? crystalRecord.accentColor
          : null,
      from: resolveCrystalSourceIndex(
        crystalRecord.from,
        rawCrystals,
        Math.max(0, index - 1),
      ),
      enabled: index === 0 ? true : crystalRecord.enabled !== false,
      twinType: index === 0 ? "penetration" : resolvedTwinType,
      ruleType: index === 0 ? "axis" : resolvedRuleType,
      plane: rule?.plane ?? crystalRecord.plane,
      axis: rule?.axis ?? crystalRecord.axis,
      rotationAngleDeg:
        rule?.rotationAngleDeg ?? crystalRecord.rotationAngleDeg ?? 60,
      offsets,
      contact: crystalRecord.contact,
      faces: crystalRecord.faces,
    };
  });
  const baseFaces =
    normalizedCrystals[0]?.faces ??
    (Array.isArray(raw.faces) ? raw.faces : undefined) ??
    [];
  const derivedCrystal = normalizedCrystals[1] ?? null;
  return {
    ...raw,
    mode: "twin",
    shortDescription: metadata.shortDescription,
    description: metadata.description,
    reference: metadata.reference,
    fullReference: metadata.fullReference,
    faces: baseFaces,
    twin: {
      enabled: normalizedCrystals.length > 1,
      type: derivedCrystal?.twinType ?? "penetration",
      ruleType:
        derivedCrystal?.ruleType ??
        twinRuleTypeForTwinType(derivedCrystal?.twinType),
      plane: derivedCrystal?.plane,
      axis: derivedCrystal?.axis,
      rotationAngleDeg: derivedCrystal?.rotationAngleDeg,
      contact: derivedCrystal?.contact,
      crystals: normalizedCrystals,
    },
  };
}

/** 貫入双晶の offset 配列を検証する。MVP では axis offset だけを許可する。 */
function validateTwinOffsetShape(rawOffsets: unknown, path: string) {
  if (rawOffsets == null) {
    return;
  }
  if (!Array.isArray(rawOffsets)) {
    throw createTwinImportError(`${path} は配列である必要があります。`);
  }
  rawOffsets.forEach((rawOffset, index) => {
    const offsetPath = `${path}[${index}]`;
    if (!isPlainRecord(rawOffset)) {
      throw createTwinImportError(
        `${offsetPath} は object である必要があります。`,
      );
    }
    if (rawOffset.kind != null && rawOffset.kind !== "axis") {
      throw createTwinImportError(`${offsetPath}.kind が不正です。`);
    }
    if (rawOffset.basis != null && rawOffset.basis !== "twin-axis") {
      throw createTwinImportError(`${offsetPath}.basis が不正です。`);
    }
    if (rawOffset.unit != null && rawOffset.unit !== "axis-plane-intercept") {
      throw createTwinImportError(`${offsetPath}.unit が不正です。`);
    }
    if (
      rawOffset.amount != null &&
      (typeof rawOffset.amount !== "number" ||
        !Number.isFinite(rawOffset.amount))
    ) {
      throw createTwinImportError(
        `${offsetPath}.amount は有限な数値である必要があります。`,
      );
    }
  });
}

/** 結晶 1 件分の twin 設定 JSON を検証する。 */
function validateTwinCrystalShape(
  rawCrystal: unknown,
  path: string,
  crystalSystem: string,
) {
  if (!isPlainRecord(rawCrystal)) {
    throw createTwinImportError(`${path} は object である必要があります。`);
  }
  if (rawCrystal.id != null && typeof rawCrystal.id !== "string") {
    throw createTwinImportError(`${path}.id は文字列である必要があります。`);
  }
  if (
    rawCrystal.accentColor != null &&
    (typeof rawCrystal.accentColor !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(rawCrystal.accentColor))
  ) {
    throw createTwinImportError(
      `${path}.accentColor は #RRGGBB 形式の文字列である必要があります。`,
    );
  }
  if (
    rawCrystal.twinType != null &&
    rawCrystal.twinType !== "contact" &&
    rawCrystal.twinType !== "penetration"
  ) {
    throw createTwinImportError(`${path}.twinType が不正です。`);
  }
  if (rawCrystal.from != null) {
    if (
      !(
        (typeof rawCrystal.from === "number" &&
          Number.isInteger(rawCrystal.from) &&
          rawCrystal.from >= 0 &&
          rawCrystal.from <= JSON_IMPORT_LIMITS.maxTwinCrystals) ||
        typeof rawCrystal.from === "string"
      )
    ) {
      throw createTwinImportError(
        `${path}.from は 0 以上の整数または結晶 id である必要があります。`,
      );
    }
  }
  if (rawCrystal.enabled != null && typeof rawCrystal.enabled !== "boolean") {
    throw createTwinImportError(
      `${path}.enabled は真偽値である必要があります。`,
    );
  }
  if (rawCrystal.rotationAngleDeg != null) {
    if (
      typeof rawCrystal.rotationAngleDeg !== "number" ||
      !Number.isFinite(rawCrystal.rotationAngleDeg) ||
      rawCrystal.rotationAngleDeg < -JSON_IMPORT_LIMITS.maxRotationAngleDeg ||
      rawCrystal.rotationAngleDeg > JSON_IMPORT_LIMITS.maxRotationAngleDeg
    ) {
      throw createTwinImportError(
        `${path}.rotationAngleDeg は有限な角度である必要があります。`,
      );
    }
  }
  validateTwinOffsetShape(rawCrystal.offsets, `${path}.offsets`);
  validateTwinOffsetShape(rawCrystal.offset, `${path}.offset`);
  if (rawCrystal.contact != null) {
    if (!isPlainRecord(rawCrystal.contact)) {
      throw createTwinImportError(
        `${path}.contact は object である必要があります。`,
      );
    }
    for (const faceRefKey of ["baseFaceRef", "derivedFaceRef"]) {
      const value = rawCrystal.contact[faceRefKey];
      if (
        value != null &&
        typeof value !== "string" &&
        !(typeof value === "number" && Number.isInteger(value) && value >= 0)
      ) {
        throw createTwinImportError(
          `${path}.contact.${faceRefKey} が不正です。`,
        );
      }
    }
    if (
      rawCrystal.contact.referenceAxisLabel != null &&
      typeof rawCrystal.contact.referenceAxisLabel !== "string"
    ) {
      throw createTwinImportError(
        `${path}.contact.referenceAxisLabel は文字列である必要があります。`,
      );
    }
  }
  if (rawCrystal.placement != null) {
    if (!isPlainRecord(rawCrystal.placement)) {
      throw createTwinImportError(
        `${path}.placement は object である必要があります。`,
      );
    }
    if (
      rawCrystal.placement.type != null &&
      rawCrystal.placement.type !== "contact" &&
      rawCrystal.placement.type !== "penetration"
    ) {
      throw createTwinImportError(`${path}.placement.type が不正です。`);
    }
    if (rawCrystal.placement.rule != null) {
      if (!isPlainRecord(rawCrystal.placement.rule)) {
        throw createTwinImportError(
          `${path}.placement.rule は object である必要があります。`,
        );
      }
      if (
        rawCrystal.placement.rule.kind != null &&
        rawCrystal.placement.rule.kind !== "axis" &&
        rawCrystal.placement.rule.kind !== "plane"
      ) {
        throw createTwinImportError(`${path}.placement.rule.kind が不正です。`);
      }
      if (rawCrystal.placement.rule.rotationAngleDeg != null) {
        const rotationAngleDeg = rawCrystal.placement.rule.rotationAngleDeg;
        if (
          typeof rotationAngleDeg !== "number" ||
          !Number.isFinite(rotationAngleDeg) ||
          rotationAngleDeg < -JSON_IMPORT_LIMITS.maxRotationAngleDeg ||
          rotationAngleDeg > JSON_IMPORT_LIMITS.maxRotationAngleDeg
        ) {
          throw createTwinImportError(
            `${path}.placement.rule.rotationAngleDeg は有限な角度である必要があります。`,
          );
        }
      }
    }
    validateTwinOffsetShape(
      rawCrystal.placement.offsets,
      `${path}.placement.offsets`,
    );
    validateTwinOffsetShape(
      rawCrystal.placement.offset,
      `${path}.placement.offset`,
    );
  }
  if (rawCrystal.faces != null) {
    validateParameterImportShape({
      crystalSystem,
      faces: rawCrystal.faces,
    });
  }
}

/** 双晶 JSON の twin block / v2 document を実行時検証する。 */
export function validateTwinImportShape(raw: unknown) {
  if (!isPlainRecord(raw)) {
    throw createTwinImportError(
      "JSON のルートは object である必要があります。",
    );
  }
  if (isTwinDocumentV2(raw)) {
    const rawCrystals = raw.crystals as unknown[];
    const metadata = getTwinDocumentMetadata(raw);
    validateParameterImportShape({
      ...raw,
      version: 1,
      shortDescription: metadata.shortDescription,
      description: metadata.description,
      reference: metadata.reference,
      fullReference: metadata.fullReference,
      faces:
        isPlainRecord(rawCrystals[0]) && Array.isArray(rawCrystals[0].faces)
          ? rawCrystals[0].faces
          : [],
    });
    if (rawCrystals.length === 0) {
      throw createTwinImportError("crystals は 1 件以上必要です。");
    }
    if (rawCrystals.length > JSON_IMPORT_LIMITS.maxTwinCrystals) {
      throw createTwinImportError(
        `crystals が多すぎます。上限は ${JSON_IMPORT_LIMITS.maxTwinCrystals} 件です。`,
      );
    }
    rawCrystals.forEach((crystal, index) =>
      validateTwinCrystalShape(
        crystal,
        `crystals[${index}]`,
        raw.crystalSystem as string,
      ),
    );
    return;
  }

  validateParameterImportShape(raw);
  if (raw.mode != null && raw.mode !== "twin") {
    throw createTwinImportError("双晶 JSON の mode が不正です。");
  }
  if (raw.twin == null) {
    return;
  }
  if (!isPlainRecord(raw.twin)) {
    throw createTwinImportError("twin は object である必要があります。");
  }
  const twin = raw.twin;
  if (twin.enabled != null && typeof twin.enabled !== "boolean") {
    throw createTwinImportError("twin.enabled は真偽値である必要があります。");
  }
  if (
    twin.type != null &&
    twin.type !== "contact" &&
    twin.type !== "penetration"
  ) {
    throw createTwinImportError("twin.type が不正です。");
  }
  if (twin.crystals != null) {
    if (!Array.isArray(twin.crystals)) {
      throw createTwinImportError("twin.crystals は配列である必要があります。");
    }
    if (twin.crystals.length > JSON_IMPORT_LIMITS.maxTwinCrystals) {
      throw createTwinImportError(
        `twin.crystals が多すぎます。上限は ${JSON_IMPORT_LIMITS.maxTwinCrystals} 件です。`,
      );
    }
    twin.crystals.forEach((crystal, index) =>
      validateTwinCrystalShape(
        crystal,
        `twin.crystals[${index}]`,
        raw.crystalSystem as string,
      ),
    );
  }
}
