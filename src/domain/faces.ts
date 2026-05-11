import { type CrystalSystemId, usesFourAxisMiller } from "./crystalSystems.js";

/**
 * 面定義の既定値、指数正規化、等価面判定を扱う。
 *
 * 面一覧 UI、JSON 正規化、preview 色 grouping が同じ等価面ロジックに依存するため、
 * 面とその軌道計算はここに集約する。
 */

const FACE_KEY_EPSILON = 1e-9;
export const LEGACY_ZERO_COEFFICIENT_DISTANCE = 100;

/** 面上テキストの既定値。面追加時の初期 state として使う。 */
export const FACE_TEXT_DEFAULTS = {
  content: "",
  fontId: "helvetiker",
  fontSize: 5,
  depth: 1,
  offsetU: 0,
  offsetV: 0,
  rotationDeg: 0,
};

/** 表示・保存・grouping が扱う face の最小公開 shape。 */
export interface CrystalFace {
  id?: string;
  h: number;
  k: number;
  i?: number;
  l: number;
  distance?: number;
  enabled?: boolean;
  accentColor?: string | null;
  draft?: boolean;
  draftGroupKey?: string;
  draftEmptyFields?: string[];
  text?: Partial<typeof FACE_TEXT_DEFAULTS>;
}

interface FaceLikeRecord {
  h?: unknown;
  k?: unknown;
  i?: unknown;
  l?: unknown;
}

interface FaceDistanceLikeRecord {
  coefficient?: unknown;
  distance?: unknown;
  enabled?: unknown;
}

/** 面 id 用の一意文字列を生成する。crypto がない環境では簡易 fallback を使う。 */
function createFaceId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `face-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function normalizeFaceDistance(raw: FaceDistanceLikeRecord, fallback = 1) {
  const distance = raw.distance == null ? NaN : Number(raw.distance);
  if (Number.isFinite(distance)) {
    return distance;
  }

  const coefficient = raw.coefficient == null ? NaN : Number(raw.coefficient);
  if (Number.isFinite(coefficient)) {
    return coefficient > 0 ? 1 / coefficient : LEGACY_ZERO_COEFFICIENT_DISTANCE;
  }

  return fallback;
}

function isDisabledLegacyCoefficient(raw: FaceDistanceLikeRecord) {
  return raw.distance == null &&
    raw.coefficient != null &&
    Number.isFinite(Number(raw.coefficient))
    ? Number(raw.coefficient) <= 0
    : false;
}

/**
 * 面 1 枚分の既定値を持つ object を作る。
 *
 * 入力:
 * - 各 field の上書き値
 *
 * 出力:
 * - text 既定値や一意 id を含んだ face object
 */
export function createFace(
  overrides: Record<string, unknown> &
    FaceDistanceLikeRecord & {
      text?: Partial<typeof FACE_TEXT_DEFAULTS>;
    } = {},
) {
  const textOverrides = overrides.text ?? {};
  const rest = { ...overrides };
  delete rest.coefficient;
  delete rest.distance;
  delete rest.enabled;
  delete rest.text;
  return {
    id: createFaceId(),
    h: 1,
    k: 0,
    i: -1,
    l: 0,
    distance: normalizeFaceDistance(overrides),
    enabled: isDisabledLegacyCoefficient(overrides)
      ? false
      : typeof overrides.enabled === "boolean"
        ? overrides.enabled
        : true,
    text: {
      ...FACE_TEXT_DEFAULTS,
      ...textOverrides,
    },
    ...rest,
  };
}

/**
 * 面指数を結晶系向けに正規化する。
 *
 * 六方 / 三方では `i = -(h + k)` を強制し、微小誤差で 0 がぶれないよう丸める。
 */
export function normalizeFaceForSystem<TFace extends object & FaceLikeRecord>(
  face: TFace,
  systemId: CrystalSystemId | string,
) {
  const next: Record<string, unknown> = {
    ...(face as Record<string, unknown>),
  };

  for (const fieldName of ["h", "k", "i", "l"]) {
    const numeric = Number(next[fieldName]);
    if (Number.isFinite(numeric)) {
      next[fieldName] = Math.abs(numeric) < FACE_KEY_EPSILON ? 0 : numeric;
    }
  }

  if (usesFourAxisMiller(systemId)) {
    const h = Number(next["h"]);
    const k = Number(next["k"]);
    next["i"] =
      Number.isFinite(h) && Number.isFinite(k)
        ? normalizeIndexValue(-(h + k))
        : Number(next["i"]);
  }

  return next as TFace;
}

/** 面キー用に指数値を安定化する。 */
function normalizeIndexValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || Math.abs(numeric) < FACE_KEY_EPSILON) {
    return 0;
  }
  return Math.round(numeric * 1e9) / 1e9;
}

/** 等価面判定用のキーを作る。 */
function buildFaceKey(face, systemId) {
  const normalized = normalizeFaceForSystem(face, systemId);
  const parts = [
    normalizeIndexValue(normalized.h),
    normalizeIndexValue(normalized.k),
  ];

  if (usesFourAxisMiller(systemId)) {
    parts.push(normalizeIndexValue(normalized.i));
  }

  parts.push(normalizeIndexValue(normalized.l));
  return parts.join("|");
}

/** 結晶系向けに正規化した面 object を 1 枚生成する。 */
function createSystemFace(
  systemId,
  distance,
  indexes,
  text = undefined,
  accentColor = undefined,
) {
  return normalizeFaceForSystem(
    createFace({
      ...indexes,
      distance,
      text,
      ...(accentColor != null ? { accentColor } : {}),
    }),
    systemId,
  );
}

/** 六方 4 指数の 60 度回転。等価面展開に使う。 */
function rotateFourAxis60(face) {
  return {
    h: -Number(face.k),
    k: Number(face.h) + Number(face.k),
    l: Number(face.l),
  };
}

/** 三方晶系の 3 回対称による面回転。 */
function rotateTrigonalThreeAxis(face) {
  return {
    h: Number(face.i),
    k: Number(face.h),
    l: Number(face.l),
  };
}

/** 三方晶系で l の正負を反転した別軌道を作る。 */
function flipTrigonalLOrbit(face) {
  return {
    h: Number(face.h),
    k: Number(face.i),
    l: -Number(face.l),
  };
}

/** 三方晶系の等価面軌道を正負 l 両側で組み立てる。 */
function buildTrigonalEquivalentOrbit(face) {
  const positiveOrbit = buildEquivalentOrbit(face, "trigonal", [
    rotateTrigonalThreeAxis,
  ]);
  const negativeSeed = createSystemFace(
    "trigonal",
    face.distance,
    flipTrigonalLOrbit(face),
    face.text,
  );
  const negativeOrbit = buildEquivalentOrbit(negativeSeed, "trigonal", [
    rotateTrigonalThreeAxis,
  ]);

  return [...positiveOrbit, ...negativeOrbit];
}

/** 六方晶系の等価面軌道を正負 l 両側で組み立てる。 */
function buildHexagonalEquivalentOrbit(face) {
  const positiveOrbit = buildEquivalentOrbit(face, "hexagonal", [
    rotateFourAxis60,
  ]);
  const negativeSeed = createSystemFace(
    "hexagonal",
    face.distance,
    {
      h: Number(face.h),
      k: Number(face.k),
      l: -Number(face.l),
    },
    face.text,
  );
  const negativeOrbit = buildEquivalentOrbit(negativeSeed, "hexagonal", [
    rotateFourAxis60,
  ]);

  return [...positiveOrbit, ...negativeOrbit];
}

/**
 * 与えた変換群で面の等価軌道を幅優先で展開する。
 *
 * seen をキー管理にしているのは、同じ面へ戻る回転群でも無限ループしないため。
 */
function buildEquivalentOrbit(seedFace, systemId, transforms) {
  const orbit = [];
  const queue = [normalizeFaceForSystem(seedFace, systemId)];
  const seen = new Set();

  while (queue.length > 0) {
    const face = queue.shift();
    const key = buildFaceKey(face, systemId);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    orbit.push(face);

    for (const transform of transforms) {
      queue.push(
        createSystemFace(
          systemId,
          face.distance,
          transform(face),
          face.text,
          face.accentColor,
        ),
      );
    }
  }

  return orbit;
}

/** 立方晶系の 24 対称を使って等価面候補を列挙する。 */
function getCubicEquivalentFaces(face) {
  const values = [Number(face.h), Number(face.k), Number(face.l)];
  const permutations = [
    [0, 1, 2],
    [0, 2, 1],
    [1, 0, 2],
    [1, 2, 0],
    [2, 0, 1],
    [2, 1, 0],
  ];
  const permutationSigns = [1, -1, -1, 1, 1, -1];
  const orbit = [];

  permutations.forEach((permutation, index) => {
    const permutationSign = permutationSigns[index];

    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          if (sx * sy * sz !== permutationSign) {
            continue;
          }

          orbit.push(
            createSystemFace(
              "cubic",
              face.distance,
              {
                h: sx * values[permutation[0]],
                k: sy * values[permutation[1]],
                l: sz * values[permutation[2]],
              },
              face.text,
              face.accentColor,
            ),
          );
        }
      }
    }
  });

  return orbit;
}

/** 結晶系ごとの対称性に応じた等価面軌道を返す。 */
function getEquivalentOrbit(face, systemId) {
  const normalizedFace = normalizeFaceForSystem(face, systemId);

  let orbit;
  switch (systemId) {
    case "cubic":
      orbit = getCubicEquivalentFaces(normalizedFace);
      break;
    case "tetragonal":
      orbit = buildEquivalentOrbit(normalizedFace, systemId, [
        (candidate) => ({
          h: Number(candidate.k),
          k: -Number(candidate.h),
          l: Number(candidate.l),
        }),
        (candidate) => ({
          h: Number(candidate.h),
          k: Number(candidate.k),
          l: -Number(candidate.l),
        }),
      ]);
      break;
    case "orthorhombic":
      orbit = buildEquivalentOrbit(normalizedFace, systemId, [
        (candidate) => ({
          h: Number(candidate.h),
          k: -Number(candidate.k),
          l: -Number(candidate.l),
        }),
        (candidate) => ({
          h: -Number(candidate.h),
          k: Number(candidate.k),
          l: -Number(candidate.l),
        }),
      ]);
      break;
    case "hexagonal":
      orbit = buildHexagonalEquivalentOrbit(normalizedFace);
      break;
    case "trigonal":
      orbit = buildTrigonalEquivalentOrbit(normalizedFace);
      break;
    case "monoclinic":
      orbit = buildEquivalentOrbit(normalizedFace, systemId, [
        (candidate) => ({
          h: -Number(candidate.h),
          k: Number(candidate.k),
          l: -Number(candidate.l),
        }),
        (candidate) => ({
          h: Number(candidate.h),
          k: -Number(candidate.k),
          l: Number(candidate.l),
        }),
      ]);
      break;
    case "triclinic":
      orbit = buildEquivalentOrbit(normalizedFace, systemId, [
        (candidate) => ({
          h: -Number(candidate.h),
          k: -Number(candidate.k),
          l: -Number(candidate.l),
        }),
      ]);
      break;
    default:
      orbit = [
        createSystemFace(systemId, normalizedFace.distance, normalizedFace),
      ];
      break;
  }

  return {
    normalizedFace,
    orbit,
  };
}

/** 同じ等価面グループに属する面で共通になるキーを返す。 */
export function getEquivalentFaceGroupKey(
  face: FaceLikeRecord,
  systemId: CrystalSystemId | string,
) {
  const { orbit } = getEquivalentOrbit(face, systemId);
  return orbit
    .map((candidate) => buildFaceKey(candidate, systemId))
    .sort()
    .join("::");
}

/** 指定面から、まだ存在しない等価面候補を列挙する。 */
export function createEquivalentFaces(
  face: CrystalFace,
  systemId: CrystalSystemId | string,
) {
  const { normalizedFace, orbit } = getEquivalentOrbit(face, systemId);

  const sourceKey = buildFaceKey(normalizedFace, systemId);
  const unique = new Map();
  for (const candidate of orbit) {
    const key = buildFaceKey(candidate, systemId);
    if (key === sourceKey || unique.has(key)) {
      continue;
    }
    unique.set(key, candidate);
  }

  return [...unique.values()];
}

/** 既存面一覧に不足している等価面だけを抽出する。 */
export function createMissingEquivalentFaces(
  existingFaces: CrystalFace[],
  sourceFace: CrystalFace,
  systemId: CrystalSystemId | string,
) {
  const existingKeys = new Set(
    existingFaces.map((face) => buildFaceKey(face, systemId)),
  );
  return createEquivalentFaces(sourceFace, systemId).filter(
    (candidate) => !existingKeys.has(buildFaceKey(candidate, systemId)),
  );
}

/** 結晶系ごとの初期面セットを返す。 */
export function createDefaultFacesForSystem(
  systemId: CrystalSystemId | string,
) {
  switch (systemId) {
    case "hexagonal":
      return [
        createFace({ h: 1, k: 0, l: 0 }),
        createFace({ h: 0, k: 1, l: 0 }),
        createFace({ h: -1, k: 1, l: 0 }),
        createFace({ h: -1, k: 0, l: 0 }),
        createFace({ h: 0, k: -1, l: 0 }),
        createFace({ h: 1, k: -1, l: 0 }),
        createFace({ h: 0, k: 0, l: 1 }),
        createFace({ h: 0, k: 0, l: -1 }),
      ].map((face) => normalizeFaceForSystem(face, systemId));
    case "trigonal":
      return [
        createFace({ h: 1, k: 0, l: 1 }),
        createFace({ h: 0, k: -1, l: 1 }),
        createFace({ h: -1, k: 1, l: 1 }),
        createFace({ h: 1, k: 0, l: -1 }),
        createFace({ h: 0, k: -1, l: -1 }),
        createFace({ h: -1, k: 1, l: -1 }),
      ].map((face) => normalizeFaceForSystem(face, systemId));
    default:
      return [
        createFace({ h: 1, k: 0, l: 0 }),
        createFace({ h: -1, k: 0, l: 0 }),
        createFace({ h: 0, k: 1, l: 0 }),
        createFace({ h: 0, k: -1, l: 0 }),
        createFace({ h: 0, k: 0, l: 1 }),
        createFace({ h: 0, k: 0, l: -1 }),
      ].map((face) => normalizeFaceForSystem(face, systemId));
  }
}
