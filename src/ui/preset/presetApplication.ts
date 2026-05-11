import {
  createDefaultTwinParameters,
  normalizeTwinParameters,
} from "../../domain/parameters.js";
import { normalizeTwinPreviewStyleSettings } from "../../preview/previewStyleSettings.js";
import { normalizeTwinPreviewFaceDisplayMode } from "../../preview/previewProfiles.js";

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
 * preset の結晶構成をそのまま使う。単結晶 preset は既存の双晶状態を解除し、
 * twin 定義を持つ preset だけが双晶として反映される。
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
  const next = normalizeTwinParameters(normalizedPreset);
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
