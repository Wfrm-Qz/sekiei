import {
  CRYSTAL_SYSTEMS,
  createFace,
  getCrystalSystemLabel,
  isFieldLocked,
  usesFourAxisMiller,
} from "../constants.js";
import { getPresetById, getSelectablePresets } from "../data/presets.js";
import { getCurrentLocale, t } from "../i18n.js";
import { getAvailableContactReferenceAxisLabels } from "../domain/contactReferenceAxis.js";
import { createCrystalUiColors } from "../state/colorHelpers.js";
import {
  buildTwinFaceTableHeaderMarkup,
  type TwinFaceSortState,
} from "./faceTable/faceTable.js";
import {
  applyTwinAngleFieldValues,
  applyTwinAxisFieldValues,
  applyTwinFaceSectionColors,
  applyTwinPreviewStyleAxisLabels,
  applyTwinPreviewToggleValues,
  applyTwinPreviewStyleValues,
  applyTwinRuleFieldValues,
  buildTwinFromCrystalOptions,
} from "./formRender.js";
import { queryAppPageElements } from "./page/pageElements.js";
import {
  buildTwinPresetMetadataViewModel,
  type TwinPresetMetadataInputElements,
  populateTwinPresetMetadataInputs,
} from "./preset/presetMetadata.js";
import {
  createDefaultTwinAxisRule,
  createDefaultTwinParameters,
} from "../domain/parameters.js";
import type { TwinStlSplitSettings } from "../state/stlSplitSettings.js";
import { applySettingsPanelViewModel } from "./settingsPanel.js";
import {
  getTwinCrystal,
  getTwinCrystalFaces,
  getTwinCrystals,
  twinRuleTypeForTwinType,
} from "../state/stateHelpers.js";
import {
  createCrystalTabElement,
  createCrystalVisibilityToggleElement,
  replaceSelectOptions,
} from "./uiMarkup.js";
import {
  filterPresetOptions,
  findPresetOptionFromQuery,
  getPresetOptionLabel,
  renderPresetOptionsPopup,
  syncPresetComboboxUi,
} from "./preset/presetCombobox.js";
import {
  applyTwinPresetToState,
  shouldApplyPresetPreviewSettings,
} from "./preset/presetApplication.js";

/**
 * preset / form 再描画処理を `main.ts` から切り離す helper 群。
 *
 * DOM 同期は副作用を持つが、幾何計算や preview 本体ほど複雑ではないため、
 * 先に module 化して `main.ts` の責務を軽くする。
 *
 * 主に扱う日本語文言:
 * - 一致するプリセットはありません / カスタム入力 / 自動
 * - 面 {index} (...) / 係数 / 面を全削除 / 面を追加
 * - 生成元結晶の接触面 / この結晶の接触面 / 双晶則を設定します
 * - 結晶を追加 / 結晶タブの操作
 */

type TwinParametersLike = ReturnType<typeof createDefaultTwinParameters>;
type PageElements = ReturnType<typeof queryAppPageElements>;
type TwinCrystalLike = NonNullable<ReturnType<typeof getTwinCrystal>>;
type TwinFaceLike = ReturnType<typeof createFace>;

/** form / preset UI helper が参照する最小限の state。 */
export interface TwinPageUiStateLike {
  parameters: TwinParametersLike;
  stlSplit: TwinStlSplitSettings;
  presetQuery: string;
  presetPopupOpen: boolean;
  pendingPreviewRefit?: boolean;
  activeFaceCrystalIndex: number;
  faceDisplayMode: string;
  showFaceLabels: boolean;
  showAxisLabels: boolean;
  showAxisLinesInner: boolean;
  showAxisLinesOuter: boolean;
  showTwinRuleGuide: boolean;
  showSplitPlaneGuide: boolean;
  showRidgeLines: boolean;
  showIntersectionRidgeLines: boolean;
  showPresetMetadata: boolean;
  useInertia: boolean;
  previewStyleSettings: unknown;
  faceSort: TwinFaceSortState | null;
}

/** form / preset UI helper に外から渡す依存関係。 */
export interface PageUiActionContext {
  state: TwinPageUiStateLike;
  elements: PageElements;
  formatCrystalTabLabel: (index: number) => string;
  formatCrystalUiLabel: (index: number) => string;
  buildFaceIndexText: (face: TwinFaceLike, crystalSystem: string) => string;
  getActiveCrystalIndex: () => number;
  getActiveCrystal: (parameters?: TwinParametersLike) => TwinCrystalLike | null;
  getEditableCrystalIndex: () => number;
  closeTabMenuPopover: () => void;
  applyPresetMetadataSectionVisibility: () => void;
  updatePresetMetadataOverlay: () => void;
  renderAxisViewButtons: () => void;
  renderFaceRows: () => void;
  setCrystalVisibilityDefaults: (parameters?: TwinParametersLike) => void;
  syncPreview: () => void;
  syncFaceSectionCardHeight?: () => void;
  resetPreviewViewToFit: () => void;
  isCrystalVisible: (crystal: TwinCrystalLike, index: number) => boolean;
}

/**
 * preset / form UI action 群を返す。
 *
 * 戻り値の各関数は DOM と state の同期を担う副作用関数で、`main.ts` 側では
 * イベント契約と preview 同期だけに集中できるようにする。
 */
export function createPageUiActions(context: PageUiActionContext) {
  /** querySelector ベースの広い Element 型を、この page で期待する具象型へ寄せる。 */
  function getTypedElements() {
    return {
      crystalSystemSelect: context.elements
        .crystalSystemSelect as HTMLSelectElement,
      presetOptionsPopup: context.elements.presetOptionsPopup as HTMLElement,
      presetSelect: context.elements.presetSelect as HTMLInputElement,
      presetClearButton: context.elements.presetClearButton as HTMLElement,
      presetToggleButton: context.elements.presetToggleButton as HTMLElement,
      metadataInputs: context.elements
        .metadataInputs as TwinPresetMetadataInputElements,
      sizeInput: context.elements.sizeInput as HTMLInputElement,
      stlSplitEnabledInput: context.elements
        .stlSplitEnabledInput as HTMLInputElement,
      stlSplitPlaneInputs: {
        h: context.elements.stlSplitPlaneInputs.h as HTMLInputElement,
        k: context.elements.stlSplitPlaneInputs.k as HTMLInputElement,
        i: context.elements.stlSplitPlaneInputs.i as HTMLInputElement,
        l: context.elements.stlSplitPlaneInputs.l as HTMLInputElement,
      },
      twinTypeSelect: context.elements.twinTypeSelect as HTMLSelectElement,
      fromCrystalSelect: context.elements
        .fromCrystalSelect as HTMLSelectElement,
      baseFaceRefSelect: context.elements
        .baseFaceRefSelect as HTMLSelectElement,
      derivedFaceRefSelect: context.elements
        .derivedFaceRefSelect as HTMLSelectElement,
      contactReferenceAxisSelect: context.elements
        .contactReferenceAxisSelect as HTMLSelectElement,
      rotationAngleInput: context.elements
        .rotationAngleInput as HTMLInputElement,
    };
  }

  /** preset picker に表示する候補一覧を返す。 */
  function getSelectablePresetOptions() {
    return getSelectablePresets();
  }

  /** 結晶系 select を現在ロケールのラベルで再構築する。 */
  function renderCrystalSystemOptions() {
    const { crystalSystemSelect } = getTypedElements();
    crystalSystemSelect.innerHTML = "";
    CRYSTAL_SYSTEMS.forEach((system) => {
      const option = document.createElement("option");
      option.value = system.id;
      option.textContent = getCrystalSystemLabel(system, getCurrentLocale());
      crystalSystemSelect.append(option);
    });
  }

  /** preset id から、現在言語で解決済みの表示ラベルを返す。 */
  function getPresetLabelById(presetId: string) {
    return getPresetOptionLabel(getSelectablePresetOptions(), presetId);
  }

  /** 現在の検索文字列から一致する preset 定義を 1 件返す。 */
  function findPresetFromQuery(query: string) {
    const matchedPreset = findPresetOptionFromQuery(
      getSelectablePresetOptions(),
      query,
    );
    return matchedPreset ? getPresetById(matchedPreset.id) : null;
  }

  /**
   * 現在言語と検索文字列に基づいて、双晶用プリセット候補 popup を作り直す。
   *
   * preset 適用時は twin state だけでなく active crystal tab も巻き込むため、
   * 適用処理はこの module 側でまとめて持つ。
   */
  function renderPresetOptions() {
    const presets = filterPresetOptions(
      getSelectablePresetOptions(),
      context.state.presetQuery,
    );

    renderPresetOptionsPopup({
      popup: getTypedElements().presetOptionsPopup,
      options: presets,
      noMatchesText: t("common.noPresetMatches"),
      onSelect: (presetId) => {
        const selectablePreset = getSelectablePresetOptions().find(
          (candidate) => candidate.id === presetId,
        );
        const preset = getPresetById(presetId);
        if (!preset) {
          return;
        }
        if (!preset.parameters) {
          applyCustomPresetSelection(
            selectablePreset?.label ?? getPresetLabelById("custom"),
          );
          closePresetPopup();
          return;
        }
        context.state.presetQuery =
          selectablePreset?.label ?? getPresetLabelById(preset.id);
        applyTwinPreset(preset);
        closePresetPopup();
      },
    });
  }

  /** preset combobox の入力欄・popup・clear button の見た目を同期する。 */
  function syncPresetInputUi() {
    const {
      presetSelect,
      presetClearButton,
      presetToggleButton,
      presetOptionsPopup,
    } = getTypedElements();
    syncPresetComboboxUi(
      {
        input: presetSelect,
        clearButton: presetClearButton,
        toggleButton: presetToggleButton,
        popup: presetOptionsPopup,
      },
      context.state.presetQuery,
      context.state.presetPopupOpen,
      renderPresetOptions,
    );
  }

  /** preset popup を開く。 */
  function openPresetPopup() {
    context.state.presetPopupOpen = true;
    syncPresetInputUi();
  }

  /** preset popup を閉じる。 */
  function closePresetPopup() {
    context.state.presetPopupOpen = false;
    syncPresetInputUi();
  }

  /** custom preset 選択時の UI と state を同期する。 */
  function applyCustomPresetSelection(
    label = getPresetLabelById("custom") || t("preset.custom.label"),
  ) {
    context.state.presetQuery = label;
    context.state.parameters.presetId = "custom";
    renderFormValues();
  }

  /**
   * preset を state へ反映し、フォームと preview を同期する。
   *
   * twin block を持つ preset は定義をそのまま使い、持たない preset は現在の twin 状態を
   * 温存したまま結晶データだけを取り込む。
   */
  function applyTwinPreset(
    preset: NonNullable<ReturnType<typeof getPresetById>>,
  ) {
    applyTwinPresetToState({
      state: context.state,
      preset,
      shouldApplyPresetPreviewSettings,
      onAfterApply: () => renderFormValues(),
      onAfterSync: () => context.syncPreview(),
    });
  }

  /** 面一覧ヘッダーを現在のソート状態付きで描画する。 */
  function renderFaceTableHeader() {
    context.elements.facesTableHeadRow.innerHTML =
      buildTwinFaceTableHeaderMarkup({
        useFourAxis: usesFourAxisMiller(context.state.parameters.crystalSystem),
        sort: context.state.faceSort ?? null,
        labels: {
          coefficient: t("common.coefficient"),
          deleteAllFaces: t("common.deleteAllFaces"),
          addFace: t("common.addFace"),
          sortAscending: (label) => t("common.sortAscending", { label }),
          sortDescending: (label) => t("common.sortDescending", { label }),
        },
      });
  }

  /**
   * 接触双晶で使う「生成元接触面 / この結晶の接触面」select を再構築する。
   *
   * active crystal と parent crystal の face 配列に直接対応しているため、
   * crystal 切り替え時は必ず呼び直す必要がある。
   */
  function renderFaceRefOptions() {
    const activeCrystalIndex = context.getActiveCrystalIndex();
    const activeCrystal = context.getActiveCrystal();
    const parentIndex =
      activeCrystalIndex === 0
        ? 0
        : Math.max(
            0,
            Math.min(activeCrystal?.from ?? 0, activeCrystalIndex - 1),
          );
    const baseFaces = getTwinCrystalFaces(
      context.state.parameters,
      parentIndex,
    ).filter((face) => !face.draft);
    const derivedFaces = getTwinCrystalFaces(
      context.state.parameters,
      activeCrystalIndex,
    ).filter((face) => !face.draft);
    const baseOptions = baseFaces.map((face, index) => ({
      value: String(face.id),
      label: t("faceList.faceLabel", {
        index: index + 1,
        faceIndexText: context.buildFaceIndexText(
          face,
          context.state.parameters.crystalSystem,
        ),
      }),
    }));
    const derivedOptions = derivedFaces.map((face, index) => ({
      value: String(face.id),
      label: t("faceList.faceLabel", {
        index: index + 1,
        faceIndexText: context.buildFaceIndexText(
          face,
          context.state.parameters.crystalSystem,
        ),
      }),
    }));

    const { baseFaceRefSelect, derivedFaceRefSelect } = getTypedElements();
    replaceSelectOptions(baseFaceRefSelect, baseOptions);
    replaceSelectOptions(derivedFaceRefSelect, derivedOptions);
  }

  /** 接触双晶の基準方向 select を、現在の結晶系に応じた候補へ差し替える。 */
  function renderContactReferenceAxisOptions() {
    const { contactReferenceAxisSelect } = getTypedElements();

    const labels = getAvailableContactReferenceAxisLabels(
      context.state.parameters.crystalSystem,
    );
    replaceSelectOptions(contactReferenceAxisSelect, [
      { value: "", label: t("common.auto") },
      ...labels.map((label) => ({ value: label, label })),
    ]);
  }

  /**
   * active crystal に応じて、双晶パラメーターカードの表示内容を切り替える。
   *
   * base crystal では設定欄を隠し、penetration / contact で rule 欄と contact 欄を出し分ける。
   */
  function renderTwinSettings() {
    const useFourAxis = usesFourAxisMiller(
      context.state.parameters.crystalSystem,
    );
    const activeCrystalIndex = context.getActiveCrystalIndex();
    const activeCrystal = context.getActiveCrystal();
    const isBaseCrystal = activeCrystalIndex === 0;
    const parentIndex = isBaseCrystal
      ? 0
      : Math.max(
          0,
          Math.min(Number(activeCrystal?.from ?? 0), activeCrystalIndex - 1),
        );
    const ruleType =
      activeCrystal?.ruleType ??
      twinRuleTypeForTwinType(activeCrystal?.twinType);
    const showRuleInputs = !isBaseCrystal && ruleType === "axis";
    const showContactFields =
      !isBaseCrystal && activeCrystal?.twinType === "contact";
    applySettingsPanelViewModel(
      {
        card: context.elements.twinSettingsCard as HTMLElement,
        note: context.elements.twinSettingsNote as HTMLElement,
        fields: context.elements.twinSettingsFields as HTMLElement,
        ruleHeading: context.elements.twinRuleHeading as HTMLElement,
        ruleFields: context.elements.twinRuleFields as HTMLElement,
        ruleIField: context.elements.twinRuleIField as HTMLElement,
        axisAngleField: context.elements.twinAxisAngleField as HTMLElement,
        contactFields: context.elements.twinContactFields as HTMLElement,
        baseFaceRefLabel: context.elements.baseFaceRefLabel as HTMLElement,
        derivedFaceRefLabel: context.elements
          .derivedFaceRefLabel as HTMLElement,
      },
      {
        noteText: isBaseCrystal
          ? t("twin.settingsNote.base")
          : t("twin.settingsNote.derived", {
              label: context.formatCrystalUiLabel(activeCrystalIndex),
            }),
        ruleHeadingText:
          ruleType === "axis"
            ? t("twin.ruleIndex.axis")
            : t("twin.ruleIndex.plane"),
        baseFaceRefLabelText: t("twin.baseContactFace", {
          index: parentIndex + 1,
        }),
        derivedFaceRefLabelText: t("twin.derivedContactFace", {
          label: context.formatCrystalUiLabel(activeCrystalIndex),
        }),
        showFields: !isBaseCrystal,
        showRuleInputs,
        showFourAxisRuleIndex: useFourAxis,
        showContactFields,
      },
    );
  }

  /** 面一覧の編集対象結晶タブを再構築する。 */
  function renderFaceCrystalTabs() {
    const activeIndex = context.getEditableCrystalIndex();
    const crystals = getTwinCrystals(context.state.parameters);
    const fragment = document.createDocumentFragment();
    crystals.forEach((crystal, index) => {
      const isActive = index === activeIndex;
      const label = context.formatCrystalTabLabel(index);
      const fullLabel = context.formatCrystalUiLabel(index);
      const uiColors = createCrystalUiColors(index, crystal?.accentColor);
      fragment.append(
        createCrystalTabElement({
          index,
          label,
          isActive,
          menuAriaLabel: t("crystals.tabMenuAria", { label: fullLabel }),
          tabBackground: uiColors.tabBackground,
          tabHoverBackground: uiColors.tabHoverBackground,
          tabActiveBackground: uiColors.tabActiveBackground,
          tabBorder: uiColors.tabBorder,
        }),
      );
    });
    const addButton = document.createElement("button");
    addButton.id = "app-add-crystal-tab";
    addButton.className = "crystal-tab crystal-tab-add";
    addButton.type = "button";
    addButton.disabled = crystals.length >= 8;
    addButton.setAttribute("aria-label", t("crystals.add"));
    addButton.textContent = "+";
    context.elements.faceCrystalTabsContainer.replaceChildren(
      fragment,
      addButton,
    );
  }

  /** プレビュー用の結晶表示 ON/OFF チップ列を現在の crystal 一覧に合わせて再構築する。 */
  function renderCrystalVisibilityToggles() {
    context.setCrystalVisibilityDefaults();
    const fragment = document.createDocumentFragment();
    getTwinCrystals(context.state.parameters).forEach((crystal, index) => {
      const label = context.formatCrystalUiLabel(index);
      fragment.append(
        createCrystalVisibilityToggleElement({
          index,
          label,
          checked: context.isCrystalVisible(crystal, index),
          disabled: index > 0 && crystal?.enabled === false,
        }),
      );
    });
    context.elements.crystalVisibilityToggles.replaceChildren(fragment);
  }

  /**
   * フォーム値を state から再反映する。
   *
   * preset 情報カード、結晶系入力、双晶則、接触双晶 select、面一覧まで一括で同期するため、
   * preset 適用や import 後はこの関数を経由させる。
   */
  function renderFormValues(options: { preserveTabMenu?: boolean } = {}) {
    const typedElements = getTypedElements();
    if (context.state.parameters.presetId !== "custom") {
      context.state.presetQuery =
        getPresetLabelById(context.state.parameters.presetId) || "";
    }
    if (!options.preserveTabMenu) {
      context.closeTabMenuPopover();
    }
    syncPresetInputUi();
    context.applyPresetMetadataSectionVisibility();
    populateTwinPresetMetadataInputs(
      typedElements.metadataInputs,
      buildTwinPresetMetadataViewModel(
        context.state.parameters,
        getCurrentLocale() as "ja" | "en",
      ),
    );
    typedElements.crystalSystemSelect.value =
      context.state.parameters.crystalSystem;
    typedElements.sizeInput.value = String(context.state.parameters.sizeMm);
    typedElements.stlSplitEnabledInput.checked =
      context.state.stlSplit.enabled === true;
    typedElements.stlSplitPlaneInputs.h.value = String(
      context.state.stlSplit.plane?.h ?? 1,
    );
    typedElements.stlSplitPlaneInputs.k.value = String(
      context.state.stlSplit.plane?.k ?? 1,
    );
    typedElements.stlSplitPlaneInputs.i.value = String(
      context.state.stlSplit.plane?.i ?? 0,
    );
    typedElements.stlSplitPlaneInputs.l.value = String(
      context.state.stlSplit.plane?.l ?? 1,
    );
    if (context.elements.stlSplitPlaneIField instanceof HTMLElement) {
      const showFourAxisSplitPlane = usesFourAxisMiller(
        context.state.parameters.crystalSystem,
      );
      context.elements.stlSplitPlaneIField.hidden = !showFourAxisSplitPlane;
      context.elements.stlSplitPlaneIField.style.display =
        showFourAxisSplitPlane ? "" : "none";
      typedElements.stlSplitPlaneInputs.i.disabled = !showFourAxisSplitPlane;
    }

    applyTwinAxisFieldValues(
      context.elements.axisInputs,
      context.state.parameters.axes,
      context.state.parameters.crystalSystem,
      isFieldLocked,
    );
    applyTwinAngleFieldValues(
      context.elements.angleInputs,
      context.state.parameters.angles,
      context.state.parameters.crystalSystem,
      isFieldLocked,
    );

    const activeCrystalIndex = context.getActiveCrystalIndex();
    const activeCrystal = context.getActiveCrystal();
    typedElements.twinTypeSelect.value =
      activeCrystal?.twinType ?? "penetration";
    const ruleType =
      activeCrystal?.ruleType ??
      twinRuleTypeForTwinType(activeCrystal?.twinType);
    const rule =
      ruleType === "axis"
        ? (activeCrystal?.axis ??
          createDefaultTwinAxisRule(context.state.parameters.crystalSystem))
        : (activeCrystal?.plane ??
          createFace({ h: 1, k: 1, l: 1, coefficient: 1 }));
    applyTwinRuleFieldValues(
      context.elements.twinRuleInputs,
      rule,
      typedElements.rotationAngleInput,
      activeCrystal?.rotationAngleDeg ?? 60,
    );
    applyTwinPreviewToggleValues(context.elements, {
      faceDisplayMode: context.state.faceDisplayMode,
      showFaceLabels: context.state.showFaceLabels,
      showAxisLabels: context.state.showAxisLabels,
      showAxisLinesInner: context.state.showAxisLinesInner,
      showAxisLinesOuter: context.state.showAxisLinesOuter,
      showTwinRuleGuide: context.state.showTwinRuleGuide,
      showSplitPlaneGuide: context.state.showSplitPlaneGuide,
      showRidgeLines: context.state.showRidgeLines,
      showIntersectionRidgeLines: context.state.showIntersectionRidgeLines,
      showPresetMetadata: context.state.showPresetMetadata,
      useInertia: context.state.useInertia,
    });
    applyTwinPreviewStyleValues(
      context.elements.previewStylePanel,
      context.state.previewStyleSettings,
    );
    applyTwinPreviewStyleAxisLabels(
      context.elements.previewStylePanel,
      usesFourAxisMiller(context.state.parameters.crystalSystem),
      t,
    );
    context.updatePresetMetadataOverlay();
    const activeCrystalUiColors = createCrystalUiColors(
      context.getEditableCrystalIndex(),
      getTwinCrystal(
        context.state.parameters,
        context.getEditableCrystalIndex(),
      )?.accentColor,
    );
    applyTwinFaceSectionColors(context.elements, activeCrystalUiColors);

    context.setCrystalVisibilityDefaults();
    renderTwinSettings();
    renderFaceCrystalTabs();
    renderCrystalVisibilityToggles();
    context.renderAxisViewButtons();
    renderFaceTableHeader();
    renderFaceRefOptions();
    renderContactReferenceAxisOptions();
    replaceSelectOptions(
      typedElements.fromCrystalSelect,
      buildTwinFromCrystalOptions(
        getTwinCrystals(context.state.parameters),
        activeCrystalIndex,
        context.formatCrystalUiLabel,
      ),
    );
    typedElements.fromCrystalSelect.value = String(
      activeCrystalIndex === 0 ? 0 : (activeCrystal?.from ?? 0),
    );
    typedElements.baseFaceRefSelect.value =
      activeCrystal?.contact?.baseFaceRef ?? "";
    typedElements.derivedFaceRefSelect.value =
      activeCrystal?.contact?.derivedFaceRef ?? "";
    typedElements.contactReferenceAxisSelect.value =
      activeCrystal?.contact?.referenceAxisLabel ?? "";
    context.renderFaceRows();
    context.syncFaceSectionCardHeight?.();
  }

  return {
    renderCrystalSystemOptions,
    renderPresetOptions,
    getPresetLabelById,
    findPresetFromQuery,
    syncPresetInputUi,
    openPresetPopup,
    closePresetPopup,
    applyCustomPresetSelection,
    applyTwinPreset,
    renderFaceTableHeader,
    renderFaceRefOptions,
    renderContactReferenceAxisOptions,
    renderTwinSettings,
    renderFaceCrystalTabs,
    renderCrystalVisibilityToggles,
    renderFormValues,
  };
}
