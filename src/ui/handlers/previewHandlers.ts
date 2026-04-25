import { readTwinParametersContent } from "../../domain/parameters.js";
import { JSON_IMPORT_LIMITS } from "../../io/parameters.js";
import {
  createDefaultTwinPreviewStyleSettings,
  isTwinPreviewSettingsDocument,
  normalizeTwinPreviewStyleSettings,
  type TwinPreviewStyleSettings,
  writeTwinPreviewStyleValue,
} from "../../preview/previewStyleSettings.js";
import { normalizeTwinPreviewFaceDisplayMode } from "../../preview/previewProfiles.js";
import { getTwinCrystal } from "../../state/stateHelpers.js";
import type { TwinStlSplitSettings } from "../../state/stlSplitSettings.js";

/**
 * preview / toggle まわりの event handler をまとめる module。
 *
 * preview 表示切り替えや import 後の再同期は entry 側でも事故りやすいため、
 * ここでは DOM 配線だけを一箇所へ寄せて、state 更新ロジック自体は context 経由で受ける。
 *
 * 主に扱う日本語文言:
 * - この JSON にはプレビュー設定が含まれていません。
 * - JSON の読み込みに失敗しました: ...
 */

interface TwinPreviewHandlersCrystalLike {
  id?: string | null;
}

interface TwinPreviewHandlersParametersLike {
  twin?: unknown;
}

type TwinPreviewImportMode = "both" | "preview-only" | "crystal-only";

interface TwinPreviewHandlersStateLike {
  parameters: TwinPreviewHandlersParametersLike;
  stlSplit: TwinStlSplitSettings;
  activeFaceCrystalIndex: number;
  pendingPreviewRefit?: boolean;
  useInertia: boolean;
  previewInertiaActive: boolean;
  showAxisLinesInner: boolean;
  showAxisLinesOuter: boolean;
  showFaceLabels: boolean;
  crystalVisibility: Record<string, boolean>;
  showAxisLabels: boolean;
  showTwinRuleGuide: boolean;
  showSplitPlaneGuide: boolean;
  showPresetMetadata: boolean;
  showRidgeLines: boolean;
  showIntersectionRidgeLines: boolean;
  faceDisplayMode: string;
  previewStyleSettings: TwinPreviewStyleSettings;
}

interface TwinPreviewHandlersElementsLike {
  toggleInertiaInput: HTMLInputElement;
  axisViewButtons: HTMLElement;
  toggleAxisLinesInnerInput: HTMLInputElement;
  toggleAxisLinesOuterInput: HTMLInputElement;
  toggleFaceLabelsInput: HTMLInputElement;
  crystalVisibilityToggles: HTMLElement;
  toggleAxisLabelsInput: HTMLInputElement;
  toggleTwinRuleInput: HTMLInputElement;
  togglePresetMetadataInput: HTMLInputElement;
  toggleSplitPlaneInput: HTMLInputElement;
  toggleRidgeLinesInput: HTMLInputElement;
  toggleIntersectionRidgeLinesInput: HTMLInputElement;
  faceDisplayModeSelect: HTMLSelectElement;
  previewStylePanel: HTMLElement | null;
  downloadPreviewDebugButton: HTMLButtonElement | null;
  resetPreviewButton: HTMLButtonElement;
  importJsonInput: HTMLInputElement;
}

export interface TwinPreviewHandlersContext {
  state: TwinPreviewHandlersStateLike;
  elements: TwinPreviewHandlersElementsLike;
  controls: { staticMoving: boolean };
  orientPreviewToAxis: (axisLabel: string) => void;
  applyAxisGuideVisibility: () => void;
  applyLabelLayerVisibility: () => void;
  requestPreviewOverlayUpdate: () => void;
  setPreview: () => void;
  isCrystalVisible: (
    crystal: TwinPreviewHandlersCrystalLike | null,
    index: number,
  ) => boolean;
  applyPreviewHelperVisibility: () => void;
  updatePresetMetadataOverlay: () => void;
  resetPreviewViewToFit: () => void;
  downloadPreviewDebugSnapshot: () => void;
  renderFormValues: () => void;
  syncPreview: () => void;
  alert: (message: string) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

/** preview / toggle / import の handler 群を返す。 */
export function createTwinPreviewHandlers(context: TwinPreviewHandlersContext) {
  function resetPreviewStyleSettings(scope: "basic" | "advanced") {
    const defaults = createDefaultTwinPreviewStyleSettings();
    const current =
      context.state.previewStyleSettings ??
      createDefaultTwinPreviewStyleSettings();
    context.state.previewStyleSettings =
      scope === "basic"
        ? {
            ...current,
            faceLabel: structuredClone(defaults.faceLabel),
            axisLabel: structuredClone(defaults.axisLabel),
            twinRuleLabel: structuredClone(defaults.twinRuleLabel),
            presetMetadataName: structuredClone(defaults.presetMetadataName),
            presetMetadataDescription: structuredClone(
              defaults.presetMetadataDescription,
            ),
            axisLines: structuredClone(defaults.axisLines),
            ridgeLines: structuredClone(defaults.ridgeLines),
            intersectionLines: structuredClone(defaults.intersectionLines),
          }
        : {
            ...current,
            customFaceProfile: structuredClone(defaults.customFaceProfile),
            customLineProfile: structuredClone(defaults.customLineProfile),
          };
    context.renderFormValues();
    context.setPreview();
    context.updatePresetMetadataOverlay();
    context.applyLabelLayerVisibility();
    context.requestPreviewOverlayUpdate();
  }

  /** import の適用対象を UI select から読み、未知値は `both` に倒す。 */
  function getPreviewImportMode(): TwinPreviewImportMode {
    const mode = context.elements.importJsonInput.dataset.importMode;
    return mode === "preview-only" || mode === "crystal-only" || mode === "both"
      ? mode
      : "both";
  }

  /**
   * preview import でも通常 JSON import と同じサイズ上限を適用する。
   *
   * `preview-only` 経路は twin parameter reader を通らないため、ここで弾かないと
   * 過大 JSON をそのまま `file.text()` / `JSON.parse()` してしまう。
   */
  function assertImportJsonFileSize(file: File) {
    if (file.size > JSON_IMPORT_LIMITS.maxFileSizeBytes) {
      throw new Error(
        `JSON ファイルが大きすぎます。上限は ${Math.round(
          JSON_IMPORT_LIMITS.maxFileSizeBytes / 1024,
        )} KB です。`,
      );
    }
  }

  /** preview 詳細 JSON の適用では、面 mode と style 設定を一緒に差し替える。 */
  function applyImportedPreviewSettings(
    faceDisplayMode: unknown,
    previewStyleSettings: unknown,
  ) {
    context.state.faceDisplayMode =
      normalizeTwinPreviewFaceDisplayMode(faceDisplayMode);
    context.state.previewStyleSettings =
      normalizeTwinPreviewStyleSettings(previewStyleSettings);
    context.renderFormValues();
    context.setPreview();
  }

  /** preview 操作 toggle と各 helper 表示切り替えを登録する。 */
  function registerPreviewToggleHandlers() {
    context.elements.previewStylePanel?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest<HTMLButtonElement>(
        "button[data-preview-style-reset-scope]",
      );
      if (!button) {
        return;
      }
      const scope = button.dataset.previewStyleResetScope;
      if (scope === "basic" || scope === "advanced") {
        resetPreviewStyleSettings(scope);
      }
    });

    context.elements.toggleInertiaInput.addEventListener("change", () => {
      context.state.useInertia = context.elements.toggleInertiaInput.checked;
      context.controls.staticMoving = !context.state.useInertia;
      context.state.previewInertiaActive = false;
    });

    context.elements.axisViewButtons.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      const axisLabel = target.dataset.axisLabel;
      if (!axisLabel) {
        return;
      }
      context.orientPreviewToAxis(axisLabel);
    });

    context.elements.toggleAxisLinesInnerInput.addEventListener(
      "change",
      () => {
        context.state.showAxisLinesInner =
          context.elements.toggleAxisLinesInnerInput.checked;
        context.applyAxisGuideVisibility();
      },
    );

    context.elements.toggleAxisLinesOuterInput.addEventListener(
      "change",
      () => {
        context.state.showAxisLinesOuter =
          context.elements.toggleAxisLinesOuterInput.checked;
        context.applyAxisGuideVisibility();
      },
    );

    context.elements.toggleFaceLabelsInput.addEventListener("change", () => {
      context.state.showFaceLabels =
        context.elements.toggleFaceLabelsInput.checked;
      context.applyLabelLayerVisibility();
      context.requestPreviewOverlayUpdate();
    });

    context.elements.crystalVisibilityToggles.addEventListener(
      "change",
      (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
          return;
        }
        const crystalIndex = Number(target.dataset.crystalIndex);
        const crystal = getTwinCrystal(context.state.parameters, crystalIndex);
        if (!crystal) {
          return;
        }
        context.state.crystalVisibility = {
          ...context.state.crystalVisibility,
          [crystal.id ?? `crystal-${crystalIndex}`]: target.checked,
        };
        context.setPreview();
      },
    );

    context.elements.toggleAxisLabelsInput.addEventListener("change", () => {
      context.state.showAxisLabels =
        context.elements.toggleAxisLabelsInput.checked;
      context.applyAxisGuideVisibility();
      context.applyLabelLayerVisibility();
      context.requestPreviewOverlayUpdate();
    });

    context.elements.toggleTwinRuleInput.addEventListener("change", () => {
      context.state.showTwinRuleGuide =
        context.elements.toggleTwinRuleInput.checked;
      context.applyPreviewHelperVisibility();
      context.applyLabelLayerVisibility();
      context.requestPreviewOverlayUpdate();
    });

    context.elements.togglePresetMetadataInput.addEventListener(
      "change",
      () => {
        context.state.showPresetMetadata =
          context.elements.togglePresetMetadataInput.checked;
        context.updatePresetMetadataOverlay();
      },
    );

    context.elements.toggleSplitPlaneInput.addEventListener("change", () => {
      context.state.showSplitPlaneGuide =
        context.elements.toggleSplitPlaneInput.checked;
      context.applyPreviewHelperVisibility();
    });

    context.elements.toggleRidgeLinesInput.addEventListener("change", () => {
      context.state.showRidgeLines =
        context.elements.toggleRidgeLinesInput.checked;
      context.applyPreviewHelperVisibility();
    });

    context.elements.toggleIntersectionRidgeLinesInput.addEventListener(
      "change",
      () => {
        context.state.showIntersectionRidgeLines =
          context.elements.toggleIntersectionRidgeLinesInput.checked;
        context.applyPreviewHelperVisibility();
      },
    );

    context.elements.faceDisplayModeSelect.addEventListener("change", () => {
      context.state.faceDisplayMode =
        context.elements.faceDisplayModeSelect.value;
      context.setPreview();
    });

    context.elements.previewStylePanel?.addEventListener("input", (event) => {
      const target = event.target;
      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLSelectElement)
      ) {
        return;
      }
      const key = target.dataset.previewStyleKey;
      if (!key) {
        return;
      }
      const nextValue =
        target instanceof HTMLInputElement && target.type === "checkbox"
          ? target.checked
          : target.dataset.previewStyleValueType === "number"
            ? Number(target.value)
            : target.value;
      context.state.previewStyleSettings = writeTwinPreviewStyleValue(
        context.state.previewStyleSettings ??
          createDefaultTwinPreviewStyleSettings(),
        key,
        nextValue,
      );
      if (
        key.startsWith("customLineProfile.") ||
        key.startsWith("customFaceProfile.")
      ) {
        context.state.faceDisplayMode = "custom";
        context.elements.faceDisplayModeSelect.value = "custom";
      }
      if (key === "customLineProfile.hiddenSurfaceLineCustomColor") {
        context.state.previewStyleSettings = writeTwinPreviewStyleValue(
          context.state.previewStyleSettings,
          "customLineProfile.hiddenSurfaceLineColorMode",
          "custom",
        );
      }
      if (key === "customLineProfile.occludedInteriorLineCustomColor") {
        context.state.previewStyleSettings = writeTwinPreviewStyleValue(
          context.state.previewStyleSettings,
          "customLineProfile.occludedInteriorLineColorMode",
          "custom",
        );
      }
      context.setPreview();
      context.updatePresetMetadataOverlay();
      context.applyLabelLayerVisibility();
      context.requestPreviewOverlayUpdate();
    });

    context.elements.resetPreviewButton.addEventListener("click", () => {
      context.resetPreviewViewToFit();
    });

    context.elements.downloadPreviewDebugButton?.addEventListener(
      "click",
      () => {
        context.downloadPreviewDebugSnapshot();
      },
    );
  }

  /** JSON import の handler を登録する。 */
  function registerPreviewImportHandlers() {
    context.elements.importJsonInput.addEventListener("change", async () => {
      const [file] = context.elements.importJsonInput.files ?? [];
      if (!file) {
        return;
      }

      try {
        assertImportJsonFileSize(file);
        const content = await file.text();
        const importMode = getPreviewImportMode();
        const parsed = JSON.parse(content);
        const previewDocument = isTwinPreviewSettingsDocument(parsed)
          ? parsed
          : null;

        if (importMode !== "preview-only") {
          const parametersSource = previewDocument?.parameters ?? parsed;
          context.state.parameters = readTwinParametersContent(
            JSON.stringify(parametersSource),
          );
          context.state.activeFaceCrystalIndex = 0;
        }

        if (importMode !== "crystal-only" && previewDocument?.preview) {
          applyImportedPreviewSettings(
            previewDocument.preview.faceDisplayMode,
            previewDocument.preview.previewStyleSettings,
          );
        } else if (importMode === "preview-only") {
          if (!previewDocument?.preview) {
            throw new Error(context.t("import.missingPreviewSettings"));
          }
        }

        if (importMode !== "preview-only") {
          context.state.pendingPreviewRefit = true;
          context.renderFormValues();
          context.syncPreview();
        }
      } catch (error) {
        context.alert(
          context.t("common.jsonLoadFailed", {
            message:
              error instanceof Error ? error.message : String(error ?? ""),
          }),
        );
      } finally {
        context.elements.importJsonInput.value = "";
      }
    });
  }

  return {
    registerPreviewToggleHandlers,
    registerPreviewImportHandlers,
  };
}
