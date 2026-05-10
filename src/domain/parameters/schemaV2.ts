import { createFace, usesFourAxisMiller } from "../../constants.js";
import { FACE_TEXT_DEFAULTS } from "../faces.js";
import { serializeParameters } from "../../io/parameters.js";
import { TWIN_PARAMETERS_DOCUMENT_SCHEMA } from "./schemaNames.js";

/**
 * 双晶 parameter の schema v2 書き出し責務。
 *
 * 現在の runtime parameter を、`version: 2 / schema: "sekiei-document"`
 * の保存形式へ変換する。
 */

interface SerializableTwinParameters {
  crystalSystem: string;
  faces: Record<string, unknown>[];
  twin?: {
    crystals?: Record<string, unknown>[];
  };
  [key: string]: unknown;
}

/** 双晶保存 JSON を schema v2 形式で返す。 */
export function serializeTwinParameters(
  parameters: SerializableTwinParameters,
) {
  const serialized = serializeParameters(parameters);
  const useFourAxis = usesFourAxisMiller(parameters.crystalSystem);
  const serializeRule = (rule: Record<string, unknown>) => {
    const result: { h: number; k: number; l: number; i?: number } = {
      h: Number(rule.h),
      k: Number(rule.k),
      l: Number(rule.l),
    };
    if (useFourAxis) {
      result.i = Number(rule.i);
    }
    return result;
  };

  /**
   * crystal ごとの face 配列を schema v2 保存形へ変換する。
   *
   * 現在の runtime では `faces[].text` を保持できるため、復活待ちの文字加工設定も
   * ここで落とさず保存する。
   */
  const serializeFaces = (faces: Record<string, unknown>[]) =>
    faces.map((face) => {
      const faceText =
        face.text && typeof face.text === "object"
          ? (face.text as Record<string, unknown>)
          : undefined;
      const serializedFace: {
        id?: string;
        h: number;
        k: number;
        l: number;
        coefficient: number;
        enabled: boolean;
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
        id: typeof face.id === "string" ? face.id : undefined,
        h: Number(face.h),
        k: Number(face.k),
        l: Number(face.l),
        coefficient: Number(face.coefficient),
        enabled: face.enabled !== false,
        ...(typeof face.accentColor === "string" &&
        face.accentColor.trim().length > 0
          ? { accentColor: face.accentColor.trim() }
          : {}),
        text: {
          content: String(faceText?.content ?? FACE_TEXT_DEFAULTS.content),
          fontId: String(faceText?.fontId ?? FACE_TEXT_DEFAULTS.fontId),
          fontSize: Number(faceText?.fontSize ?? FACE_TEXT_DEFAULTS.fontSize),
          depth: Number(faceText?.depth ?? FACE_TEXT_DEFAULTS.depth),
          offsetU: Number(faceText?.offsetU ?? FACE_TEXT_DEFAULTS.offsetU),
          offsetV: Number(faceText?.offsetV ?? FACE_TEXT_DEFAULTS.offsetV),
          rotationDeg: Number(
            faceText?.rotationDeg ?? FACE_TEXT_DEFAULTS.rotationDeg,
          ),
        },
      };
      if (useFourAxis) {
        serializedFace.i = Number(face.i);
      }
      return serializedFace;
    });

  const serializeOffsets = (rawOffsets: unknown) =>
    (Array.isArray(rawOffsets) ? rawOffsets : [])
      .filter(
        (offset): offset is Record<string, unknown> =>
          Boolean(offset) &&
          typeof offset === "object" &&
          !Array.isArray(offset),
      )
      .map((offset) => ({
        kind: "axis",
        basis: "twin-axis",
        amount: Number(offset.amount ?? 0),
        unit: "axis-plane-intercept",
      }))
      .filter(
        (offset) =>
          Number.isFinite(offset.amount) && Math.abs(offset.amount) > 1e-12,
      );

  const serializedCrystals = Array.isArray(parameters.twin?.crystals)
    ? parameters.twin.crystals.map((rawCrystal, index, crystals) => {
        const crystal =
          rawCrystal && typeof rawCrystal === "object"
            ? (rawCrystal as Record<string, unknown>)
            : {};
        const sourceIndex = Math.max(
          0,
          Math.min(
            Math.trunc(Number(crystal?.from ?? 0)),
            Math.max(0, index - 1),
          ),
        );
        const sourceCrystal =
          index === 0
            ? null
            : ((crystals[sourceIndex] ?? crystals[0] ?? null) as Record<
                string,
                unknown
              > | null);
        const crystalContact =
          crystal.contact && typeof crystal.contact === "object"
            ? (crystal.contact as Record<string, unknown>)
            : {};
        const crystalAxis =
          crystal.axis && typeof crystal.axis === "object"
            ? (crystal.axis as Record<string, unknown>)
            : createFace({ l: 1 });
        const crystalPlane =
          crystal.plane && typeof crystal.plane === "object"
            ? (crystal.plane as Record<string, unknown>)
            : createFace();
        const placementType =
          index === 0
            ? null
            : crystal?.twinType === "contact"
              ? "contact"
              : "penetration";
        const ruleKind =
          index === 0
            ? null
            : crystal?.ruleType === "plane" || crystal?.twinType === "contact"
              ? "plane"
              : "axis";
        const offsets =
          placementType === "penetration"
            ? serializeOffsets(crystal.offsets)
            : [];
        return {
          id:
            typeof crystal?.id === "string"
              ? crystal.id
              : index === 0
                ? "base"
                : `derived-${index}`,
          ...(typeof crystal?.accentColor === "string" &&
          crystal.accentColor.trim().length > 0
            ? { accentColor: crystal.accentColor.trim() }
            : {}),
          enabled: crystal?.enabled !== false,
          ...(index > 0 && sourceCrystal
            ? {
                from:
                  typeof sourceCrystal?.id === "string"
                    ? sourceCrystal.id
                    : "base",
                placement: {
                  type: placementType,
                  rule: {
                    kind: ruleKind,
                    ...(ruleKind === "axis"
                      ? {
                          axis: serializeRule(crystalAxis),
                          rotationAngleDeg: Number(
                            crystal?.rotationAngleDeg ?? 60,
                          ),
                        }
                      : {
                          plane: serializeRule(crystalPlane),
                        }),
                  },
                  ...(offsets.length > 0 ? { offsets } : {}),
                },
                contact: {
                  baseFaceRef: crystalContact.baseFaceRef ?? null,
                  derivedFaceRef: crystalContact.derivedFaceRef ?? null,
                  referenceAxisLabel: crystalContact.referenceAxisLabel ?? null,
                },
              }
            : {}),
          faces: serializeFaces(
            (Array.isArray(crystal.faces) ? crystal.faces : undefined) ??
              (index === 0
                ? parameters.faces
                : Array.isArray(
                      (
                        parameters.twin?.crystals?.[0] as
                          | Record<string, unknown>
                          | undefined
                      )?.faces,
                    )
                  ? ((parameters.twin?.crystals?.[0] as Record<string, unknown>)
                      .faces as Record<string, unknown>[])
                  : parameters.faces),
          ),
        };
      })
    : [
        {
          id: "base",
          enabled: true,
          faces: serializeFaces(parameters.faces),
        },
      ];

  return {
    version: 2,
    schema: TWIN_PARAMETERS_DOCUMENT_SCHEMA,
    ...(typeof serialized.presetId === "string" &&
    serialized.presetId.trim().length > 0
      ? { presetId: serialized.presetId }
      : {}),
    name: serialized.name,
    metadata: {
      shortDescription: serialized.shortDescription,
      description: serialized.description,
      reference: serialized.reference,
      fullReference: serialized.fullReference,
    },
    crystalSystem: serialized.crystalSystem,
    axes: serialized.axes,
    angles: serialized.angles,
    sizeMm: serialized.sizeMm,
    crystals: serializedCrystals,
  };
}
