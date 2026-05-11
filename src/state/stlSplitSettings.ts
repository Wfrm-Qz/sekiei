import { createFace, normalizeFaceForSystem } from "../constants.js";

export interface TwinStlSplitSettings {
  enabled: boolean;
  plane: {
    h: number;
    k: number;
    i?: number;
    l: number;
  };
}

function normalizeTwinStlSplitPlane(
  raw: TwinStlSplitSettings["plane"] | Record<string, unknown> | undefined,
  crystalSystem: string,
) {
  const normalized = normalizeFaceForSystem(
    createFace({
      h: Number(raw?.h ?? 1),
      k: Number(raw?.k ?? 1),
      i: Number(raw?.i ?? 0),
      l: Number(raw?.l ?? 1),
      distance: 1,
    }),
    crystalSystem,
  );
  return {
    h: normalized.h,
    k: normalized.k,
    ...(typeof normalized.i === "number" ? { i: normalized.i } : {}),
    l: normalized.l,
  };
}

export function createDefaultTwinStlSplitSettings(
  crystalSystem: string,
): TwinStlSplitSettings {
  return {
    enabled: false,
    plane: normalizeTwinStlSplitPlane(undefined, crystalSystem),
  };
}

export function normalizeTwinStlSplitSettings(
  raw: unknown,
  crystalSystem: string,
): TwinStlSplitSettings {
  const candidate =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  return {
    enabled: candidate.enabled === true,
    plane: normalizeTwinStlSplitPlane(
      candidate.plane as Record<string, unknown> | undefined,
      crystalSystem,
    ),
  };
}
