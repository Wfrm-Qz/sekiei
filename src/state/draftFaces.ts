import { createFace, normalizeFaceForSystem } from "../constants.js";

/**
 * 面一覧の空欄下書き行を扱う helper。
 *
 * 面追加を「非等価面の自動生成」から「空欄下書き」に変えたため、
 * 下書き判定と空欄 field 群は state helper として明示的に分けておく。
 */

/** 空欄下書き面で未入力扱いにする field 一覧。 */
export const EMPTY_DRAFT_FACE_FIELDS = ["h", "k", "l", "distance"];

/** 面一覧へ追加する「空欄の新規面」下書きを作る。 */
export function createEmptyDraftFace(crystalSystem: string) {
  return normalizeFaceForSystem(
    createFace({
      h: 0,
      k: 0,
      l: 0,
      distance: 1,
      enabled: false,
      draftGroupKey:
        globalThis.crypto?.randomUUID?.() ??
        `draft-face-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      draftEmptyFields: [...EMPTY_DRAFT_FACE_FIELDS],
    }),
    crystalSystem,
  );
}

/** 下書き面でまだ空欄として扱う field 一覧を返す。 */
export function getDraftEmptyFields(
  face: { draftEmptyFields?: string[] } | null,
) {
  return Array.isArray(face?.draftEmptyFields)
    ? face.draftEmptyFields.filter((field) =>
        EMPTY_DRAFT_FACE_FIELDS.includes(field),
      )
    : [];
}

/** 下書き面かどうかを返す。 */
export function isDraftFace(face: { draftEmptyFields?: string[] } | null) {
  return getDraftEmptyFields(face).length > 0;
}
