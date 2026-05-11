import {
  DEFAULT_LOCALIZED_NAME,
  FACE_TEXT_DEFAULTS,
  applyCrystalSystemConstraints,
  createDefaultParameters,
  createFace,
  normalizeLocalizedName,
  normalizeFaceForSystem,
  usesFourAxisMiller,
} from "../constants.js";
import { normalizeFaceAccentColor } from "../state/colorHelpers.js";

/**
 * 単結晶 JSON の読み込み / 正規化 / 再シリアライズを担当する。
 *
 * 旧形式 JSON や不完全な入力も受け、UI が扱える完全な parameter object に
 * 揃えて返すのが主な責務。
 */

/** import JSON のサイズ・件数・数値範囲に対する安全側の上限。 */
export const JSON_IMPORT_LIMITS = Object.freeze({
  maxFileSizeBytes: 1_000_000,
  maxFaces: 256,
  maxTwinCrystals: 16,
  maxLocalizedNameLength: 200,
  maxShortDescriptionLength: 300,
  maxDescriptionLength: 10_000,
  maxReferenceLength: 1_000,
  maxFullReferenceLength: 10_000,
  maxFaceTextLength: 200,
  maxFaceIdLength: 128,
  maxDraftGroupKeyLength: 128,
  maxAxisLength: 1_000,
  maxSizeMm: 1_000,
  maxMillerIndexAbs: 1_000,
  maxFaceDistance: 1_000,
  maxCoefficient: 1_000,
  maxRotationAngleDeg: 360,
});

const VALID_CRYSTAL_SYSTEM_IDS = new Set([
  "cubic",
  "tetragonal",
  "orthorhombic",
  "hexagonal",
  "trigonal",
  "monoclinic",
  "triclinic",
]);

/** import バリデーション失敗を、ユーザー向けに短い文で表す。 */
function createImportValidationError(message) {
  return new Error(message);
}

/** object 前提の JSON かどうかを確認する。 */
function isPlainRecord(value): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** 数値化できない値を安全に fallback へ寄せる。 */
function toNumber(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

/** 面上テキスト設定を既定値込みで正規化する。 */
function normalizeFaceText(raw) {
  return {
    content:
      typeof raw?.content === "string"
        ? raw.content
        : FACE_TEXT_DEFAULTS.content,
    fontId:
      typeof raw?.fontId === "string" ? raw.fontId : FACE_TEXT_DEFAULTS.fontId,
    fontSize: toNumber(raw?.fontSize, FACE_TEXT_DEFAULTS.fontSize),
    depth: toNumber(raw?.depth, FACE_TEXT_DEFAULTS.depth),
    offsetU: toNumber(raw?.offsetU, FACE_TEXT_DEFAULTS.offsetU),
    offsetV: toNumber(raw?.offsetV, FACE_TEXT_DEFAULTS.offsetV),
    rotationDeg: toNumber(raw?.rotationDeg, FACE_TEXT_DEFAULTS.rotationDeg),
  };
}

/** 任意文字列 field を長さ付きで検証する。 */
function validateOptionalStringField(value, path, maxLength) {
  if (value == null) {
    return;
  }
  if (typeof value !== "string") {
    throw createImportValidationError(`${path} は文字列である必要があります。`);
  }
  if (value.length > maxLength) {
    throw createImportValidationError(
      `${path} が長すぎます。上限は ${maxLength} 文字です。`,
    );
  }
}

/** 任意数値 field を範囲付きで検証する。 */
function validateOptionalNumberField(
  value,
  path,
  options: {
    integer?: boolean;
    min?: number;
    max?: number;
  } = {},
) {
  if (value == null) {
    return;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw createImportValidationError(
      `${path} は有限な数値である必要があります。`,
    );
  }
  if (options.integer && !Number.isInteger(value)) {
    throw createImportValidationError(`${path} は整数である必要があります。`);
  }
  if (options.min != null && value < options.min) {
    throw createImportValidationError(
      `${path} は ${options.min} 以上である必要があります。`,
    );
  }
  if (options.max != null && value > options.max) {
    throw createImportValidationError(
      `${path} は ${options.max} 以下である必要があります。`,
    );
  }
}

/** face.text の安全な範囲を確認する。 */
function validateFaceTextShape(raw, path) {
  if (raw == null) {
    return;
  }
  if (!isPlainRecord(raw)) {
    throw createImportValidationError(
      `${path} は object である必要があります。`,
    );
  }
  validateOptionalStringField(
    raw.content,
    `${path}.content`,
    JSON_IMPORT_LIMITS.maxFaceTextLength,
  );
  validateOptionalStringField(raw.fontId, `${path}.fontId`, 64);
  validateOptionalNumberField(raw.fontSize, `${path}.fontSize`, {
    min: 0.1,
    max: 100,
  });
  validateOptionalNumberField(raw.depth, `${path}.depth`, {
    max: 100,
  });
  if (typeof raw.depth === "number" && Number.isFinite(raw.depth)) {
    if (Math.abs(raw.depth) > 100) {
      throw createImportValidationError(
        `${path}.depth は -100 以上 100 以下である必要があります。`,
      );
    }
  }
  validateOptionalNumberField(raw.offsetU, `${path}.offsetU`, {
    min: -1_000,
    max: 1_000,
  });
  validateOptionalNumberField(raw.offsetV, `${path}.offsetV`, {
    min: -1_000,
    max: 1_000,
  });
  validateOptionalNumberField(raw.rotationDeg, `${path}.rotationDeg`, {
    min: -360,
    max: 360,
  });
}

/** face 1 件の JSON 形状を検証する。 */
function validateFaceShape(raw, path, crystalSystem) {
  if (!isPlainRecord(raw)) {
    throw createImportValidationError(
      `${path} は object である必要があります。`,
    );
  }

  validateOptionalStringField(
    raw.id,
    `${path}.id`,
    JSON_IMPORT_LIMITS.maxFaceIdLength,
  );
  validateOptionalStringField(
    raw.draftGroupKey,
    `${path}.draftGroupKey`,
    JSON_IMPORT_LIMITS.maxDraftGroupKeyLength,
  );
  if (
    raw.accentColor != null &&
    (typeof raw.accentColor !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(raw.accentColor))
  ) {
    throw createImportValidationError(
      `${path}.accentColor は #RRGGBB 形式の文字列である必要があります。`,
    );
  }
  if (raw.draftEmptyFields != null) {
    if (
      !Array.isArray(raw.draftEmptyFields) ||
      raw.draftEmptyFields.length > 4
    ) {
      throw createImportValidationError(
        `${path}.draftEmptyFields は 4 件以下の配列である必要があります。`,
      );
    }
  }
  validateOptionalNumberField(raw.h, `${path}.h`, {
    integer: true,
    min: -JSON_IMPORT_LIMITS.maxMillerIndexAbs,
    max: JSON_IMPORT_LIMITS.maxMillerIndexAbs,
  });
  validateOptionalNumberField(raw.k, `${path}.k`, {
    integer: true,
    min: -JSON_IMPORT_LIMITS.maxMillerIndexAbs,
    max: JSON_IMPORT_LIMITS.maxMillerIndexAbs,
  });
  validateOptionalNumberField(raw.l, `${path}.l`, {
    integer: true,
    min: -JSON_IMPORT_LIMITS.maxMillerIndexAbs,
    max: JSON_IMPORT_LIMITS.maxMillerIndexAbs,
  });
  if (usesFourAxisMiller(crystalSystem)) {
    validateOptionalNumberField(raw.i, `${path}.i`, {
      integer: true,
      min: -JSON_IMPORT_LIMITS.maxMillerIndexAbs,
      max: JSON_IMPORT_LIMITS.maxMillerIndexAbs,
    });
  }
  validateOptionalNumberField(raw.distance, `${path}.distance`, {
    min: -JSON_IMPORT_LIMITS.maxFaceDistance,
    max: JSON_IMPORT_LIMITS.maxFaceDistance,
  });
  validateOptionalNumberField(raw.coefficient, `${path}.coefficient`, {
    min: 0,
    max: JSON_IMPORT_LIMITS.maxCoefficient,
  });
  if (raw.enabled != null && typeof raw.enabled !== "boolean") {
    throw createImportValidationError(
      `${path}.enabled は真偽値である必要があります。`,
    );
  }
  validateFaceTextShape(raw.text, `${path}.text`);
}

/** 単結晶 JSON の root shape を実行時検証する。 */
export function validateParameterImportShape(raw) {
  if (!isPlainRecord(raw)) {
    throw createImportValidationError(
      "JSON のルートは object である必要があります。",
    );
  }

  if (raw.version != null && raw.version !== 1) {
    throw createImportValidationError("未対応の JSON version です。");
  }
  validateOptionalStringField(
    raw.presetId,
    "presetId",
    JSON_IMPORT_LIMITS.maxFaceIdLength,
  );
  validateOptionalStringField(
    raw.shortDescription,
    "shortDescription",
    JSON_IMPORT_LIMITS.maxShortDescriptionLength,
  );
  validateOptionalStringField(
    raw.description,
    "description",
    JSON_IMPORT_LIMITS.maxDescriptionLength,
  );
  validateOptionalStringField(
    raw.reference,
    "reference",
    JSON_IMPORT_LIMITS.maxReferenceLength,
  );
  validateOptionalStringField(
    raw.fullReference,
    "fullReference",
    JSON_IMPORT_LIMITS.maxFullReferenceLength,
  );

  if (raw.name != null) {
    if (typeof raw.name === "string") {
      validateOptionalStringField(
        raw.name,
        "name",
        JSON_IMPORT_LIMITS.maxLocalizedNameLength,
      );
    } else if (isPlainRecord(raw.name)) {
      validateOptionalStringField(
        raw.name.en,
        "name.en",
        JSON_IMPORT_LIMITS.maxLocalizedNameLength,
      );
      validateOptionalStringField(
        raw.name.jp,
        "name.jp",
        JSON_IMPORT_LIMITS.maxLocalizedNameLength,
      );
    } else {
      throw createImportValidationError(
        "name は文字列または object である必要があります。",
      );
    }
  }

  if (raw.crystalSystem != null) {
    if (
      typeof raw.crystalSystem !== "string" ||
      !VALID_CRYSTAL_SYSTEM_IDS.has(raw.crystalSystem)
    ) {
      throw createImportValidationError("crystalSystem が不正です。");
    }
  }

  if (raw.axes != null) {
    if (!isPlainRecord(raw.axes)) {
      throw createImportValidationError(
        "axes は object である必要があります。",
      );
    }
    validateOptionalNumberField(raw.axes.a, "axes.a", {
      min: 0.0001,
      max: JSON_IMPORT_LIMITS.maxAxisLength,
    });
    validateOptionalNumberField(raw.axes.b, "axes.b", {
      min: 0.0001,
      max: JSON_IMPORT_LIMITS.maxAxisLength,
    });
    validateOptionalNumberField(raw.axes.c, "axes.c", {
      min: 0.0001,
      max: JSON_IMPORT_LIMITS.maxAxisLength,
    });
  }

  if (raw.angles != null) {
    if (!isPlainRecord(raw.angles)) {
      throw createImportValidationError(
        "angles は object である必要があります。",
      );
    }
    validateOptionalNumberField(raw.angles.alpha, "angles.alpha", {
      min: 0.0001,
      max: 179.9999,
    });
    validateOptionalNumberField(raw.angles.beta, "angles.beta", {
      min: 0.0001,
      max: 179.9999,
    });
    validateOptionalNumberField(raw.angles.gamma, "angles.gamma", {
      min: 0.0001,
      max: 179.9999,
    });
  }

  validateOptionalNumberField(raw.sizeMm, "sizeMm", {
    min: 0.1,
    max: JSON_IMPORT_LIMITS.maxSizeMm,
  });

  if (raw.faces != null) {
    if (!Array.isArray(raw.faces)) {
      throw createImportValidationError("faces は配列である必要があります。");
    }
    if (raw.faces.length > JSON_IMPORT_LIMITS.maxFaces) {
      throw createImportValidationError(
        `faces が多すぎます。上限は ${JSON_IMPORT_LIMITS.maxFaces} 件です。`,
      );
    }
    raw.faces.forEach((face, index) =>
      validateFaceShape(face, `faces[${index}]`, raw.crystalSystem),
    );
  }
}

/**
 * 生の JSON 由来データを単結晶 parameter object へ正規化する。
 *
 * 入力:
 * - import 直後の不完全な raw object
 *
 * 出力:
 * - 結晶系制約適用済みの完全な parameter object
 */
export function normalizeParameters(raw) {
  const base = createDefaultParameters();
  const next = structuredClone(base);

  next.version = toNumber(raw?.version, 1);
  next.presetId = typeof raw?.presetId === "string" ? raw.presetId : "custom";
  next.name = normalizeLocalizedName(raw?.name, base.name);
  next.shortDescription =
    typeof raw?.shortDescription === "string"
      ? raw.shortDescription
      : base.shortDescription;
  next.description =
    typeof raw?.description === "string" ? raw.description : base.description;
  next.reference =
    typeof raw?.reference === "string" ? raw.reference : base.reference;
  next.fullReference =
    typeof raw?.fullReference === "string"
      ? raw.fullReference
      : base.fullReference;
  next.crystalSystem =
    typeof raw?.crystalSystem === "string"
      ? raw.crystalSystem
      : base.crystalSystem;
  next.axes = {
    a: toNumber(raw?.axes?.a, base.axes.a),
    b: toNumber(raw?.axes?.b, base.axes.b),
    c: toNumber(raw?.axes?.c, base.axes.c),
  };
  next.angles = {
    alpha: toNumber(raw?.angles?.alpha, base.angles.alpha),
    beta: toNumber(raw?.angles?.beta, base.angles.beta),
    gamma: toNumber(raw?.angles?.gamma, base.angles.gamma),
  };
  next.sizeMm = toNumber(raw?.sizeMm, base.sizeMm);
  next.faces =
    Array.isArray(raw?.faces) && raw.faces.length > 0
      ? raw.faces.map((face) =>
          normalizeFaceForSystem(
            createFace({
              h: toNumber(face?.h, 1),
              k: toNumber(face?.k, 0),
              i: toNumber(face?.i, -1),
              l: toNumber(face?.l, 0),
              distance: face?.distance,
              coefficient: face?.coefficient,
              enabled:
                typeof face?.enabled === "boolean" ? face.enabled : undefined,
              accentColor: normalizeFaceAccentColor(face?.accentColor),
              text: normalizeFaceText(face?.text),
            }),
            typeof raw?.crystalSystem === "string"
              ? raw.crystalSystem
              : base.crystalSystem,
          ),
        )
      : base.faces;

  return applyCrystalSystemConstraints(next);
}

/**
 * 単結晶 parameter object を保存用 JSON へ変換する。
 *
 * 多言語 name や面上テキストの既定値補完を含め、出力 schema を安定化する。
 */
export function serializeParameters(parameters) {
  const normalizedName = normalizeLocalizedName(
    parameters.name,
    DEFAULT_LOCALIZED_NAME,
  );
  return {
    version: 1,
    presetId: parameters.presetId,
    name: {
      en: String(normalizedName.en ?? ""),
      jp: String(normalizedName.jp ?? ""),
    },
    shortDescription: String(parameters.shortDescription ?? ""),
    description: String(parameters.description ?? ""),
    reference: String(parameters.reference ?? ""),
    fullReference: String(parameters.fullReference ?? ""),
    crystalSystem: parameters.crystalSystem,
    axes: {
      a: Number(parameters.axes.a),
      b: Number(parameters.axes.b),
      c: Number(parameters.axes.c),
    },
    angles: {
      alpha: Number(parameters.angles.alpha),
      beta: Number(parameters.angles.beta),
      gamma: Number(parameters.angles.gamma),
    },
    sizeMm: Number(parameters.sizeMm),
    faces: parameters.faces.map((face) => {
      const serializedFace: {
        h: number;
        k: number;
        l: number;
        distance: number;
        enabled?: boolean;
        accentColor?: string;
        i?: number;
        text: {
          content: string;
          fontId: string;
          fontSize: number;
          depth: number;
          offsetU: number;
          offsetV: number;
          rotationDeg: number;
        };
      } = {
        h: Number(face.h),
        k: Number(face.k),
        l: Number(face.l),
        distance: Number(face.distance),
        ...(face.enabled === false ? { enabled: false } : {}),
        ...(normalizeFaceAccentColor(face.accentColor)
          ? { accentColor: normalizeFaceAccentColor(face.accentColor) }
          : {}),
        text: {
          content: String(face.text?.content ?? ""),
          fontId: String(face.text?.fontId ?? FACE_TEXT_DEFAULTS.fontId),
          fontSize: Number(face.text?.fontSize ?? FACE_TEXT_DEFAULTS.fontSize),
          depth: Number(face.text?.depth ?? FACE_TEXT_DEFAULTS.depth),
          offsetU: Number(face.text?.offsetU ?? FACE_TEXT_DEFAULTS.offsetU),
          offsetV: Number(face.text?.offsetV ?? FACE_TEXT_DEFAULTS.offsetV),
          rotationDeg: Number(
            face.text?.rotationDeg ?? FACE_TEXT_DEFAULTS.rotationDeg,
          ),
        },
      };

      if (usesFourAxisMiller(parameters.crystalSystem)) {
        serializedFace.i = Number(face.i);
      }

      return serializedFace;
    }),
  };
}

/** JSON 文字列を parse / 検証してから正規化する。 */
export function readParametersContent(content: string) {
  const parsed = JSON.parse(content);
  validateParameterImportShape(parsed);
  return normalizeParameters(parsed);
}

/** JSON ファイルを読み込み、parse / 検証後に `normalizeParameters` へ通して返す。 */
export async function readParametersFile(file) {
  if (file.size > JSON_IMPORT_LIMITS.maxFileSizeBytes) {
    throw createImportValidationError(
      `JSON ファイルが大きすぎます。上限は ${Math.round(
        JSON_IMPORT_LIMITS.maxFileSizeBytes / 1024,
      )} KB です。`,
    );
  }
  const content = await file.text();
  return readParametersContent(content);
}
/**
 * 単結晶 JSON の読み込み / 正規化 / 再シリアライズを担当する。
 *
 * 旧形式 JSON や不完全な入力も受け、UI が扱える完全な parameter object に
 * 揃えて返すのが主な責務。
 */
