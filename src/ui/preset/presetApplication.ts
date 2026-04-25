import {
  createDefaultTwinParameters,
  normalizeTwinParameters,
} from "../../domain/parameters.js";
import { normalizeTwinPreviewStyleSettings } from "../../preview/previewStyleSettings.js";
import { normalizeTwinPreviewFaceDisplayMode } from "../../preview/previewProfiles.js";
import { isTwinEnabled } from "../../state/stateHelpers.js";

type TwinParametersLike = ReturnType<typeof createDefaultTwinParameters>;

interface TwinPreviewPresetLike {
  faceDisplayMode?: string | null;
  previewStyleSettings?: unknown;
}

interface TwinPresetLike {
  id: string;
  parameters: TwinParametersLike;
  preview?: TwinPreviewPresetLike | null;
}

interface TwinPresetApplicationStateLike {
  parameters: TwinParametersLike;
  faceDisplayMode: string;
  previewStyleSettings: unknown;
  activeFaceCrystalIndex: number;
  pendingPreviewRefit?: boolean;
}

export interface ApplyTwinPresetOptions {
  state: TwinPresetApplicationStateLike;
  preset: TwinPresetLike;
  shouldApplyPresetPreviewSettings?: () => boolean;
  onAfterApply: () => void;
  onAfterSync: () => void;
}

/** 将来 option で復活させるため残している、preset 同梱 preview 適用可否。 */
export function shouldApplyPresetPreviewSettings() {
  return false;
}

/**
 * preset を state へ反映し、必要な UI/preview 再同期 callback を呼ぶ。
 *
 * twin block を持つ preset は定義をそのまま使い、持たない preset は現在の twin 状態を
 * 温存したまま結晶データだけを取り込む。
 */
export function applyTwinPresetToState({
  state,
  preset,
  shouldApplyPresetPreviewSettings:
    shouldApplyPreview = shouldApplyPresetPreviewSettings,
  onAfterApply,
  onAfterSync,
}: ApplyTwinPresetOptions) {
  const normalizedPreset = normalizeTwinParameters(preset.parameters);
  const presetHasTwinDefinition =
    Array.isArray(normalizedPreset?.twin?.crystals) &&
    normalizedPreset.twin.crystals.length > 1;
  const currentTwin = structuredClone(state.parameters.twin);
  const presetCrystalFaces = Array.isArray(normalizedPreset?.twin?.crystals)
    ? normalizedPreset.twin.crystals.map((crystal) =>
        structuredClone(Array.isArray(crystal?.faces) ? crystal.faces : []),
      )
    : [];
  const presetBaseFaces = structuredClone(
    presetCrystalFaces.find((faces) => faces.length > 0) ??
      (Array.isArray(normalizedPreset?.faces) ? normalizedPreset.faces : []),
  );
  const next = normalizeTwinParameters(
    presetHasTwinDefinition
      ? {
          ...normalizedPreset,
        }
      : {
          ...normalizedPreset,
          twin: {
            ...currentTwin,
            enabled: isTwinEnabled(state.parameters),
            crystals: currentTwin.crystals.map((crystal, index) => ({
              ...crystal,
              faces: structuredClone(
                presetCrystalFaces[index]?.length > 0
                  ? presetCrystalFaces[index]
                  : presetBaseFaces,
              ),
            })),
          },
        },
  );
  next.presetId = preset.id;
  state.parameters = next;
  if (preset.preview && shouldApplyPreview()) {
    state.faceDisplayMode = normalizeTwinPreviewFaceDisplayMode(
      preset.preview.faceDisplayMode,
    );
    state.previewStyleSettings = normalizeTwinPreviewStyleSettings(
      preset.preview.previewStyleSettings,
    );
  }
  state.activeFaceCrystalIndex = 0;
  state.pendingPreviewRefit = true;
  onAfterApply();
  onAfterSync();
}
