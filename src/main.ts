import * as THREE from "three";
import {
  createMissingEquivalentFaces,
  getEquivalentFaceGroupKey,
  getLocalizedNameText,
  normalizeFaceForSystem,
  usesFourAxisMiller,
} from "./constants.js";
import { PRESETS } from "./data/presets.js";
import {
  createFaceColorSetFromHex,
  createFaceGroupColor,
  getCrystalAccentColor as getDefaultCrystalAccentColor,
  normalizeFaceAccentColor,
} from "./state/colorHelpers.js";
import { getNextCoefficientValue } from "./ui/coefficientInput.js";
import {
  EMPTY_DRAFT_FACE_FIELDS,
  createEmptyDraftFace,
  getDraftEmptyFields,
  isDraftFace,
} from "./state/draftFaces.js";
import { createTwinCrystalMutationActions } from "./state/crystalMutations.js";
import {
  createTwinFaceMobileCardElement,
  buildTwinFaceDisplayGroupsAndState,
  buildTwinFaceGroupPalette,
  buildTwinFaceGroupRenderPlan,
  createTwinFaceRowElement,
  createTwinFaceTextRowElement,
  compareTwinFaceItemsForSort,
} from "./ui/faceTable/faceTable.js";
import { queryAppPageElements } from "./ui/page/pageElements.js";
import { createAnnouncementModalActions } from "./ui/page/announcementModal.js";
import { applyControlHelpAttributes } from "./ui/page/controlHelp.js";
import { setupHelpTooltip } from "./ui/page/helpTooltip.js";
import { createManualModalActions } from "./ui/page/manualModal.js";
import { createMobileLayoutActions } from "./ui/page/mobileLayout.js";
import { createPageUiHelpers } from "./ui/page/pageUi.js";
import { applyPageStaticTranslations } from "./ui/page/pageTranslations.js";
import {
  commitTwinPresetMetadataField,
  type TwinMetadataFieldName,
} from "./ui/preset/presetMetadata.js";
import { createTwinPreviewLabelActions } from "./preview/previewLabels.js";
import {
  createTwinPreviewGeometryActions,
  type TwinPreviewGeometryContext,
} from "./preview/previewGeometry.js";
import {
  createTwinPreviewSceneActions,
  type TwinPreviewSceneContext,
} from "./preview/previewScene.js";
import {
  createTwinPreviewControlActions,
  createTwinPreviewLifecycleActions,
  createTwinPreviewLightingActions,
  type TwinPreviewControlsContext,
  type TwinPreviewLifecycleContext,
  type TwinPreviewLightingContext,
} from "./preview/previewView.js";
import { createDeferredTrackballControls } from "./preview/deferredTrackballControls.js";
import { createDefaultTwinPreviewStyleSettings } from "./preview/previewStyleSettings.js";
import { buildFaceTextOutlineLinePositions } from "./text/faceTextGeometry.js";
import { getFaceTextFont } from "./text/fonts.js";
import {
  createTwinPreviewExportActions,
  createTwinPreviewExportRuntimeActions,
  type TwinPreviewExportContext,
  type TwinPreviewExportRuntimeContext,
} from "./export/previewExport.js";
import {
  createTwinPreviewExportSurfaceActions,
  type TwinPreviewExportSurfaceContext,
} from "./export/previewExportSurface.js";
import {
  createTwinPreviewExportGeometryActions,
  type TwinPreviewExportGeometryContext,
} from "./export/previewExportGeometry.js";
import {
  createTwinRidgeGeometryActions,
  type TwinRidgeGeometryContext,
} from "./preview/ridgeGeometry.js";
import {
  createTwinXrayOverlayActions,
  type TwinXrayOverlayContext,
} from "./preview/xrayOverlay.js";
import {
  createTwinPreviewLineActions,
  createTwinXrayPreviewStateActions,
  type TwinPreviewLineContext,
  type TwinXrayPreviewStateContext,
} from "./preview/previewXray.js";
import { createTwinPreviewRuntimeActions } from "./preview/previewRuntime.js";
import { resolveTwinPreviewLineProfile } from "./preview/previewProfiles.js";
import { createTwinExportActions } from "./export/exportActions.js";
import { createTwinFaceTableHandlers } from "./ui/faceTable/faceTableHandlers.js";
import { createPageUiActions } from "./ui/formUi.js";
import { createPageLifecycleActions } from "./ui/page/pageLifecycle.js";
import { createTwinPreviewHandlers } from "./ui/handlers/previewHandlers.js";
import { createTwinUiHandlers } from "./ui/handlers/uiHandlers.js";
import { createTwinCrystalConfigHandlers } from "./ui/handlers/crystalConfigHandlers.js";
import {
  createDefaultTwinParameters,
  normalizeTwinParameters,
} from "./domain/parameters.js";
import {
  buildFaceGroupStateKey,
  clampActiveCrystalIndex as clampTwinActiveCrystalIndex,
  formatCrystalTabLabel as formatCrystalTabLabelText,
  formatCrystalUiLabel as formatCrystalUiLabelText,
  getTwinCrystal,
  getTwinCrystalFaces,
  getTwinCrystals,
  isFaceEnabled,
  setTwinCrystalFaces,
} from "./state/stateHelpers.js";
import {
  createDefaultTwinStlSplitSettings,
  normalizeTwinStlSplitSettings,
} from "./state/stlSplitSettings.js";
import {
  getCurrentLocale,
  initializeLocale,
  onLocaleChange,
  setupLocaleSelect,
  t,
} from "./i18n.js";
import { loadFaceTextFonts } from "./text/fonts.js";
import {
  closeHeaderActionMenus,
  toggleHeaderActionMenu,
} from "./ui/headerActionMenu.js";

type TwinMeshDataBuilder =
  (typeof import("./domain/builder.js"))["buildTwinMeshData"];

const ORTHO_CAMERA_DISTANCE = 100;
const FIT_MARGIN = 1.25;
const INITIAL_PREVIEW_ZOOM_MULTIPLIER = 4 / 3;
const INITIAL_B_AXIS_ROTATION_RAD = THREE.MathUtils.degToRad(9 + 28 / 60);
const INITIAL_C_AXIS_ROTATION_RAD = THREE.MathUtils.degToRad(-(18 + 26 / 60));
const AXIS_LABEL_INITIAL_OUTER_OFFSET = 36;
const AXIS_LABEL_SIDE_GAP = 8;
const FACE_GROUP_STATE_SEPARATOR = "|||";
const FACE_SECTION_CARD_FALLBACK_HEIGHT_PX = 220;
const SHOW_ROTATION_CENTER_DEBUG_MARKER = false;
const ROTATION_CENTER_DEBUG_MARKER_SIZE_PX = 22;
const PREVIEW_HELPER_NAMES = new Set([
  "axis-guides",
  "face-normal-guides",
  "split-plane-guides",
  "twin-rule-guides",
  "face-pick-targets",
  "xray-line-depth-mask",
]);
const SVG_VECTOR_BODY_WORK_LONG_EDGE = 4096;

let twinMeshDataBuilderPromise: Promise<TwinMeshDataBuilder> | null = null;
const previewBuildRequestRef = { current: 0 };

/** CSG builder は重いため、preview 初回構築時にだけ遅延読込する。 */
function loadTwinMeshDataBuilder() {
  twinMeshDataBuilderPromise ??= import("./domain/builder.js").then(
    (module) => module.buildTwinMeshData,
  );
  return twinMeshDataBuilderPromise;
}

/**
 * アプリ本体のエントリーファイル。
 *
 * DOM 参照、双晶 parameter 編集、preview / export、面一覧操作までを束ねる。
 * 大きなファイルだが、最近のリファクタで安定した UI helper は外へ逃がしつつ、
 * 幾何計算や複雑な state 遷移はここで一元管理している。
 */

/** 現在の翻訳関数を使って「結晶1 / 結晶n」ラベルを返す。 */
function formatCrystalUiLabel(index) {
  return formatCrystalUiLabelText(index, t);
}

/** 面一覧の左タブ列で使う短い結晶ラベルを返す。 */
function formatCrystalTabLabel(index) {
  return formatCrystalTabLabelText(index, t);
}

/**
 * 初期 state を返す。
 *
 * preview 操作フラグ、xray debug、折り畳み状態など一時 state が多いため、
 * object literal を散らさず生成関数へ集約して保守しやすくしている。
 */
function createInitialState() {
  const initialParameters = normalizeTwinParameters(
    PRESETS.find((preset) => preset.id === "cube-00001")?.parameters ??
      createDefaultTwinParameters(),
  );
  const initialPreset =
    initialParameters.presetId && initialParameters.presetId !== "custom"
      ? PRESETS.find((preset) => preset.id === initialParameters.presetId)
      : null;
  return {
    parameters: initialParameters,
    presetQuery: initialPreset
      ? getLocalizedNameText(initialPreset.label, getCurrentLocale()) ||
        initialPreset.id
      : "",
    presetPopupOpen: false,
    buildResult: null,
    previewRoot: null,
    previewModelQuaternion: null,
    previewModelSystem: null,
    previewViewState: null,
    pendingInitialPreviewFit: false,
    pendingPreviewRefit: false,
    activeFaceCrystalIndex: 0,
    axisGuideGroup: null,
    splitPlaneGuideGroup: null,
    twinRuleGuideGroup: null,
    facePickTargetGroup: null,
    facePickTargets: [],
    stlSplit: createDefaultTwinStlSplitSettings(
      initialParameters.crystalSystem,
    ),
    ridgeLines: null,
    intersectionRidgeLines: null,
    faceLabelAnchors: [],
    axisLabelAnchors: [],
    twinRuleLabelAnchors: [],
    showFaceLabels: false,
    crystalVisibility: {},
    showAxisLabels: true,
    showAxisLinesInner: false,
    showAxisLinesOuter: true,
    showTwinRuleGuide: true,
    showSplitPlaneGuide: false,
    showRidgeLines: true,
    showIntersectionRidgeLines: false,
    faceDisplayMode: "grouped",
    useInertia: false,
    showPresetMetadata: false,
    presetMetadataExpanded: false,
    previewOverlayDirty: true,
    previewRenderDirty: true,
    isPreviewDragging: false,
    previewDragButton: null,
    previewInertiaActive: false,
    previewInertiaStartedAt: 0,
    previewInertiaLastChangeAt: 0,
    previewXraySortDebugFrame: 0,
    collapsedFaceGroups: {},
    faceTextEditorsExpanded: {},
    faceSort: null,
    tabMenuCrystalIndex: null,
    previewStyleSettings: createDefaultTwinPreviewStyleSettings(),
  };
}

/** 静的ラベル群へ現在ロケールの翻訳を適用する。 */
function applyStaticTranslations() {
  applyPageStaticTranslations(elements, getCurrentLocale(), t);
  applyControlHelpAttributes(document);
}

/** 面一覧編集中の active crystal index を返す。 */
function getActiveCrystalIndex() {
  return clampTwinActiveCrystalIndex(
    state.parameters,
    state.activeFaceCrystalIndex,
  );
}

/** 現在編集対象の結晶定義を返す。 */
function getActiveCrystal(parameters = state.parameters) {
  return getTwinCrystal(parameters, getActiveCrystalIndex());
}

/** 結晶がプレビュー上で表示対象かを返す。 */
function isCrystalVisible(crystal, index) {
  const key = crystal?.id ?? `crystal-${index}`;
  return state.crystalVisibility[key] !== false;
}

/** 現在プレビュー表示中の結晶 index 一覧を返す。 */
function getVisibleCrystalIndexes() {
  return getTwinCrystals(state.parameters)
    .map((crystal, index) => ({ crystal, index }))
    .filter(
      ({ crystal, index }) =>
        (index === 0 || crystal?.enabled !== false) &&
        isCrystalVisible(crystal, index),
    )
    .map(({ index }) => index);
}

/** crystalVisibility state に既定値を補う。 */
function setCrystalVisibilityDefaults(parameters = state.parameters) {
  const nextVisibility = {};
  getTwinCrystals(parameters).forEach((crystal, index) => {
    const key = crystal?.id ?? `crystal-${index}`;
    nextVisibility[key] = state.crystalVisibility[key] ?? true;
  });
  state.crystalVisibility = nextVisibility;
}

/** 現在の parameter に刻印対象の文字 content が含まれているかを返す。 */
function hasAnyFaceTextContent(parameters = state.parameters) {
  const faceCollections = [
    parameters.faces,
    ...(parameters.twin?.crystals?.map((crystal) => crystal.faces) ?? []),
  ];

  return faceCollections.some((faces) =>
    Array.isArray(faces)
      ? faces.some((face) => String(face?.text?.content ?? "").trim() !== "")
      : false,
  );
}

/** 結晶ごとの custom accent 色があれば優先し、無ければ既定 palette を返す。 */
function getCrystalAccentColor(crystalIndex: number) {
  const crystal = getTwinCrystal(state.parameters, crystalIndex);
  return getDefaultCrystalAccentColor(crystalIndex, crystal?.accentColor);
}

/** 面一覧の編集対象結晶 index を返す。 */
function getEditableCrystalIndex() {
  return getActiveCrystalIndex();
}

/** 編集対象結晶の face 配列を返す。 */
function getEditableFaces(parameters = state.parameters) {
  return getTwinCrystalFaces(parameters, getEditableCrystalIndex());
}

/** 面グループの collapse 状態保存に使う state key を作る。 */
function getFaceGroupStateKey(groupKey) {
  return buildFaceGroupStateKey(
    getEditableCrystalIndex(),
    groupKey,
    FACE_GROUP_STATE_SEPARATOR,
  );
}

/** 結晶タブのポップオーバーメニューを閉じる。 */
function closeTabMenuPopover() {
  state.tabMenuCrystalIndex = null;
  elements.faceCrystalTabsContainer
    ?.querySelectorAll(".crystal-tab-menu-trigger[aria-expanded='true']")
    .forEach((trigger) => trigger.setAttribute("aria-expanded", "false"));
  if (!elements.tabMenuPopover) {
    return;
  }
  elements.tabMenuPopover.hidden = true;
  elements.tabMenuPopover.innerHTML = "";
  elements.tabMenuPopover.style.left = "";
  elements.tabMenuPopover.style.top = "";
}

/** ヘッダー保存メニューをすべて閉じる。 */
function closeHeaderSaveMenus() {
  closeHeaderActionMenus([
    { button: elements.saveButton, menu: elements.saveMenu },
    { button: elements.saveAsButton, menu: elements.saveAsMenu },
    { button: elements.importJsonButton, menu: elements.importJsonMenu },
    {
      button: elements.mobileHeaderMenuButton,
      menu: elements.mobileHeaderMenu,
    },
  ]);
}

/** ヘッダー保存メニューを単一 open で切り替える。 */
function toggleHeaderSaveMenu(button, menu) {
  toggleHeaderActionMenu({ button, menu }, [
    { button: elements.saveButton, menu: elements.saveMenu },
    { button: elements.saveAsButton, menu: elements.saveAsMenu },
    { button: elements.importJsonButton, menu: elements.importJsonMenu },
    {
      button: elements.mobileHeaderMenuButton,
      menu: elements.mobileHeaderMenu,
    },
  ]);
}

/** import mode を hidden file input に渡して JSON picker を開く。 */
function triggerImportJsonWithMode(mode) {
  elements.importJsonInput.dataset.importMode = mode;
  elements.importJsonInput.click();
}

/** 結晶タブのポップオーバーメニューを開く。 */
function openTabMenuPopover(trigger, crystalIndex) {
  // 結晶タブメニューで見せる日本語:
  // 「結晶を複製 / 色 / 結晶削除」
  if (!elements.tabMenuPopover) {
    return;
  }
  const applyTabMenuItemLayout = (
    element: HTMLElement,
    options: { justifyBetween?: boolean } = {},
  ) => {
    element.style.display = "flex";
    element.style.alignItems = "center";
    element.style.width = "100%";
    element.style.boxSizing = "border-box";
    element.style.padding = "6px 10px";
    element.style.gap = "8px";
    if (options.justifyBetween) {
      element.style.justifyContent = "space-between";
    }
  };
  const isBaseCrystal = crystalIndex === 0;
  const crystal = getTwinCrystal(state.parameters, crystalIndex);
  const rect = trigger.getBoundingClientRect();
  state.tabMenuCrystalIndex = crystalIndex;
  elements.tabMenuPopover.replaceChildren();
  const duplicateButton = document.createElement("button");
  duplicateButton.className = "crystal-tab-menu-action";
  duplicateButton.type = "button";
  duplicateButton.dataset.tabAction = "duplicate";
  duplicateButton.dataset.crystalIndex = String(crystalIndex);
  duplicateButton.textContent = t("crystals.duplicate");
  applyTabMenuItemLayout(duplicateButton);
  elements.tabMenuPopover.append(duplicateButton);

  const colorPanel = document.createElement("div");
  colorPanel.dataset.crystalColorPanelIndex = String(crystalIndex);
  colorPanel.style.display = "grid";
  colorPanel.style.gap = "6px";
  colorPanel.style.padding = "0";
  const colorLabel = document.createElement("label");
  applyTabMenuItemLayout(colorLabel, { justifyBetween: true });
  const colorLabelText = document.createElement("span");
  colorLabelText.textContent = t("crystals.colorLabel");
  colorLabel.append(colorLabelText);
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.dataset.crystalColorIndex = String(crystalIndex);
  colorInput.value = `#${new THREE.Color(
    getDefaultCrystalAccentColor(crystalIndex, crystal?.accentColor),
  ).getHexString()}`;
  colorInput.style.width = "40px";
  colorInput.style.height = "28px";
  colorInput.style.padding = "0";
  colorInput.style.border = "none";
  colorInput.style.background = "transparent";
  colorInput.style.cursor = "pointer";
  colorLabel.append(colorInput);
  colorPanel.append(colorLabel);
  elements.tabMenuPopover.append(colorPanel);

  const deleteButton = document.createElement("button");
  deleteButton.className = "crystal-tab-menu-action";
  deleteButton.type = "button";
  deleteButton.dataset.tabAction = "delete";
  deleteButton.dataset.crystalIndex = String(crystalIndex);
  deleteButton.disabled = isBaseCrystal;
  deleteButton.textContent = t("crystals.delete");
  applyTabMenuItemLayout(deleteButton);
  elements.tabMenuPopover.append(deleteButton);
  applyControlHelpAttributes(elements.tabMenuPopover);
  trigger.setAttribute("aria-expanded", "true");
  elements.tabMenuPopover.hidden = false;
  const popoverWidth = 164;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth || popoverWidth;
  const left = Math.min(
    Math.max(8, Math.round(rect.right - popoverWidth)),
    Math.max(8, viewportWidth - popoverWidth - 8),
  );
  elements.tabMenuPopover.style.left = `${left}px`;
  elements.tabMenuPopover.style.top = `${Math.round(rect.bottom + 6)}px`;
}

/** 結晶タブのポップオーバーメニューをトグルする。 */
function toggleTabMenuPopover(trigger, crystalIndex) {
  if (
    state.tabMenuCrystalIndex === crystalIndex &&
    !elements.tabMenuPopover.hidden
  ) {
    closeTabMenuPopover();
    return;
  }
  openTabMenuPopover(trigger, crystalIndex);
}

const state = createInitialState();

const elements = queryAppPageElements();
const { initAnnouncementModal, openAnnouncement } =
  createAnnouncementModalActions({
    elements,
    getLocale: getCurrentLocale,
    onLocaleChange,
  });
const { initManualModal, openManual } = createManualModalActions({
  elements,
});
const { initMobileLayout, setActiveMobileLayoutTab } =
  createMobileLayoutActions({
    root: elements.mainContent,
    tabButtons: elements.mobileLayoutTabButtons,
    onLayoutChange: () => {
      syncFaceSectionCardHeight();
      requestPreviewOverlayUpdate();
    },
  });

/** 面一覧カードの下端を現在のビューポート下端へ合わせる。 */
function syncFaceSectionCardHeight() {
  const card = elements.faceSectionCard;
  if (!(card instanceof HTMLElement)) {
    return;
  }
  const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
  const cardTop = Math.max(card.getBoundingClientRect().top, 0);
  const nextMaxHeight = Math.max(
    FACE_SECTION_CARD_FALLBACK_HEIGHT_PX,
    Math.floor(viewportHeight - cardTop),
  );
  card.style.height = "auto";
  card.style.maxHeight = `${nextMaxHeight}px`;
}

/** entry が直接保持する Three.js runtime。 */
const renderer = new THREE.WebGLRenderer({
  canvas: elements.canvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-400, 400, 300, -300, 0.1, 2000);
camera.position.set(0, 0, ORTHO_CAMERA_DISTANCE);

const { controls, loadRealTrackballControls } = createDeferredTrackballControls(
  camera,
  elements.canvas,
);
const activePreviewTouchPointerIds = new Set<number>();
let previewTouchGestureUsedMultitouch = false;
controls.rotateSpeed = 4;
controls.zoomSpeed = 1.2;
controls.panSpeed = 10;
controls.dynamicDampingFactor = 0.12;
controls.staticMoving = true;
controls.target.set(0, 0, 0);

const rotationCenterDebugMarker = createRotationCenterDebugMarker(
  elements.previewStage,
);
const rotationCenterDebugProjection = new THREE.Vector3();

// TrackballControls の damping 中は change 発火が疎になることがあるため、
// ここを短くしすぎると慣性が視覚上ほぼ消える。操作感維持のため猶予を持たせる。
const PREVIEW_INERTIA_IDLE_TIMEOUT_MS = 800;
const PREVIEW_INERTIA_MAX_DURATION_MS = 5000;

/** 回転中心ずれ調査用 marker。通常は非表示、必要時は定数を true にする。 */
function createRotationCenterDebugMarker(previewStage) {
  if (
    !SHOW_ROTATION_CENTER_DEBUG_MARKER ||
    !(previewStage instanceof HTMLElement)
  ) {
    return null;
  }
  const marker = document.createElement("div");
  marker.setAttribute("aria-hidden", "true");
  marker.dataset.debugPreviewRotationCenter = "true";
  marker.title = "debug: preview rotation center";
  Object.assign(marker.style, {
    position: "absolute",
    left: "0",
    top: "0",
    width: `${ROTATION_CENTER_DEBUG_MARKER_SIZE_PX}px`,
    height: `${ROTATION_CENTER_DEBUG_MARKER_SIZE_PX}px`,
    transform: "translate(-50%, -50%)",
    pointerEvents: "none",
    zIndex: "5",
    display: "none",
    boxSizing: "border-box",
    border: "2px solid #ff2bd6",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.08)",
    boxShadow:
      "0 0 0 1px rgba(255, 255, 255, 0.95), 0 0 10px rgba(255, 43, 214, 0.8)",
  });

  const lineStyle = {
    position: "absolute",
    left: "50%",
    top: "50%",
    background: "#18bfff",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 0 4px rgba(24, 191, 255, 0.8)",
  };
  const horizontalLine = document.createElement("span");
  Object.assign(horizontalLine.style, {
    ...lineStyle,
    width: `${ROTATION_CENTER_DEBUG_MARKER_SIZE_PX + 8}px`,
    height: "2px",
  });
  const verticalLine = document.createElement("span");
  Object.assign(verticalLine.style, {
    ...lineStyle,
    width: "2px",
    height: `${ROTATION_CENTER_DEBUG_MARKER_SIZE_PX + 8}px`,
  });
  const centerDot = document.createElement("span");
  Object.assign(centerDot.style, {
    ...lineStyle,
    width: "5px",
    height: "5px",
    borderRadius: "999px",
    background: "#ffffff",
  });
  marker.append(horizontalLine, verticalLine, centerDot);
  previewStage.append(marker);
  return marker;
}

/** Three.js の回転中心を screen-space debug marker へ反映する。 */
function updateRotationCenterDebugMarker() {
  const marker = rotationCenterDebugMarker;
  const previewStage = elements.previewStage;
  if (!marker || !(previewStage instanceof HTMLElement)) {
    return;
  }
  if (!state.previewRoot) {
    marker.style.display = "none";
    return;
  }
  const rect = previewStage.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    marker.style.display = "none";
    return;
  }

  camera.updateMatrixWorld(true);
  rotationCenterDebugProjection.copy(controls.target).project(camera);
  if (
    !Number.isFinite(rotationCenterDebugProjection.x) ||
    !Number.isFinite(rotationCenterDebugProjection.y) ||
    !Number.isFinite(rotationCenterDebugProjection.z)
  ) {
    marker.style.display = "none";
    return;
  }

  marker.style.display = "block";
  marker.style.left = `${
    ((rotationCenterDebugProjection.x + 1) * rect.width) / 2
  }px`;
  marker.style.top = `${
    ((1 - rotationCenterDebugProjection.y) * rect.height) / 2
  }px`;
  marker.style.opacity =
    rotationCenterDebugProjection.z >= -1 &&
    rotationCenterDebugProjection.z <= 1
      ? "1"
      : "0.45";
  marker.dataset.rotationCenter = [
    controls.target.x.toFixed(4),
    controls.target.y.toFixed(4),
    controls.target.z.toFixed(4),
  ].join(",");
}

/** preview overlay 再描画要求フラグを立てる。 */
function requestPreviewOverlayUpdate() {
  state.previewOverlayDirty = true;
  state.previewRenderDirty = true;
}

/** face/line profile から screen-space overlay の利用要否を返す。 */
function shouldUseScreenSpacePreviewOverlay() {
  return (
    shouldUseScreenSpaceXrayFaceOverlay() ||
    resolveTwinPreviewLineProfile(
      state.faceDisplayMode,
      state.previewStyleSettings.customLineProfile,
    ).useScreenSpaceLineOverlay
  );
}

/** preview 本体再描画要求フラグを立てる。 */
function requestPreviewRender() {
  updateRotationCenterDebugMarker();
  state.previewRenderDirty = true;
}

/** ドラッグと慣性をまとめて「回転中」とみなす。 */
function isPreviewRotating() {
  return state.isPreviewDragging || state.previewInertiaActive;
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

/**
 * preview 表示ルール群。
 *
 * xray state、line factory、preview geometry を先に組み立て、後段の scene / lifecycle
 * へ callback として渡すことで、`main.ts` 側は wiring に集中できるようにしている。
 */
const previewXrayStateContext: TwinXrayPreviewStateContext = {
  state,
  camera,
  getCrystalAccentColor,
};

const {
  isXrayFaceDisplayMode,
  getXrayPreviewFaceOpacity,
  resolveXrayPreviewFaceColor,
  applyXrayPreviewMeshState,
  updateXrayTransparentFaceRenderOrder,
} = createTwinXrayPreviewStateActions(previewXrayStateContext);

const previewLineContext: TwinPreviewLineContext = {
  elements,
  getPreviewLineProfile: () =>
    resolveTwinPreviewLineProfile(
      state.faceDisplayMode,
      state.previewStyleSettings.customLineProfile,
    ),
};

const {
  createPreviewLineFromPoints,
  createXrayLineDepthMaskGroup,
  createWireframeFromPositionAttribute,
  createWireframeFromPositions,
  createWideLineFromPoints,
  updateWideLineResolutions,
} = createTwinPreviewLineActions(previewLineContext);

const previewGeometryContext: TwinPreviewGeometryContext = {
  state,
  getCrystalAccentColor,
  createWireframeFromPositionAttribute,
};

const {
  buildFaceCenter,
  buildPlaneBasis,
  projectFaceVerticesToPlane,
  buildSharedSolidFaceColorMap,
  buildSolidSharedFaceOverlayGroup,
  buildFlatFaceColors,
  buildDisplayGeometry,
  createGroupedFaceMeshGroup,
  createXraySolidFaceMeshGroup,
  createWireframeFromGeometry,
  buildAxisOuterSegments,
  buildAxisInnerSegment,
} = createTwinPreviewGeometryActions(previewGeometryContext);

/** preview 表示に密接に結びつく export runtime / overlay 群。 */
const previewExportRuntimeContext: TwinPreviewExportRuntimeContext = {
  state,
  elements,
  camera,
  raycaster,
  isCrystalVisible,
  getTwinCrystals,
};

const {
  hasNamedAncestor,
  getExportMaterial,
  projectWorldPointToExport,
  getPreviewTextOverlays,
  getClosestOpaqueTriangleDepth,
  buildPreviewExportOcclusionMesh,
  isWorldLinePointVisibleForExport,
  collectVisibleWorldLineSegments,
  getVisibleCrystalEntriesForExport,
  shouldUseScreenSpaceXrayFaceOverlay,
} = createTwinPreviewExportRuntimeActions(previewExportRuntimeContext);

/** 稜線 / 交線 / ラベル overlay の補助計算群。 */
const ridgeGeometryContext: TwinRidgeGeometryContext = {
  shouldKeepOccludedRidgeSegments: () =>
    resolveTwinPreviewLineProfile(
      state.faceDisplayMode,
      state.previewStyleSettings.customLineProfile,
    ).showOccludedInteriorLines,
};

const {
  buildVisibleRidgeLineData,
  buildVisibleRidgeLinePositions,
  buildCrossCrystalIntersectionLinePositions,
  buildIntersectionSegments,
  collectRidgeSplitParameters,
  buildOutlineSegmentKey,
  buildIntersectionLinePoint,
  clipLineToConvexFace,
} = createTwinRidgeGeometryActions(ridgeGeometryContext);

const {
  createFaceLabelAnchors,
  createAxisLabelAnchors,
  applyLabelLayerVisibility,
  updateFaceLabelOverlay,
} = createTwinPreviewLabelActions({
  state,
  elements,
  camera,
  raycaster,
  previewHelperNames: PREVIEW_HELPER_NAMES,
  axisLabelInitialOuterOffset: AXIS_LABEL_INITIAL_OUTER_OFFSET,
  axisLabelSideGap: AXIS_LABEL_SIDE_GAP,
});

/**
 * preview scene / controls / lifecycle。
 *
 * scene graph 構築、camera 操作、previewRoot 差し替えは密結合なので、この順で
 * module を組み立てて `setPreview()` と描画ループから利用する。
 */
const previewSceneContext: TwinPreviewSceneContext = {
  state,
  elements,
  getCrystalAccentColor,
  isCrystalVisible,
  requestPreviewRender,
  applyLabelLayerVisibility,
  createAxisLabelAnchors,
  createFaceLabelAnchors,
  createWideLineFromPoints,
  createPreviewLineFromPoints,
  createGroupedFaceMeshGroup,
  createXraySolidFaceMeshGroup,
  buildDisplayGeometry,
  buildFlatFaceColors,
  createWireframeFromGeometry,
  buildVisibleRidgeLineData,
  createWireframeFromPositions,
  buildVisibleRidgeLinePositions,
  buildCrossCrystalIntersectionLinePositions,
  buildFaceTextIntersectionLinePositions: (face, sourceFace) => {
    const previewScaledSourceFace = face?.text
      ? {
          ...sourceFace,
          text: face.text,
        }
      : sourceFace;
    return buildFaceTextOutlineLinePositions(
      face,
      previewScaledSourceFace,
      getFaceTextFont(previewScaledSourceFace?.text?.fontId),
    );
  },
  buildSharedSolidFaceColorMap,
  buildSolidSharedFaceOverlayGroup,
  createXrayLineDepthMaskGroup,
  applyXrayPreviewMeshState,
  buildFaceCenter,
  buildAxisInnerSegment,
  buildAxisOuterSegments,
};

const {
  getPreviewAxisGuides,
  applyAxisGuideVisibility,
  applyPreviewHelperVisibility,
  buildPreviewBoundsSphere,
  buildPreviewGroup,
} = createTwinPreviewSceneActions(previewSceneContext);

const {
  renderAxisViewButtons,
  updatePresetMetadataOverlay,
  applyPresetMetadataSectionVisibility,
  syncFaceListToPreviewFace,
  buildFaceIndexText,
  renderMessages,
  renderStats,
} = createPageUiHelpers({
  state,
  elements,
  getPreviewAxisGuides,
  getCurrentLocale,
  t,
  getEditableCrystalIndex,
  renderFormValues: () => renderFormValues(),
});

const previewControlsContext: TwinPreviewControlsContext = {
  state,
  elements,
  camera,
  controls,
  renderer,
  raycaster,
  pointer,
  previewHelperNames: PREVIEW_HELPER_NAMES,
  orthoCameraDistance: ORTHO_CAMERA_DISTANCE,
  fitMargin: FIT_MARGIN,
  initialPreviewZoomMultiplier: INITIAL_PREVIEW_ZOOM_MULTIPLIER,
  requestPreviewRender,
  requestPreviewOverlayUpdate,
  syncFaceListToPreviewFace,
  getPreviewAxisGuides,
  shouldUseScreenSpaceXrayFaceOverlay,
  isCrystalVisible,
  updateWideLineResolutions,
};

const {
  capturePreviewViewState,
  fitPreviewToObject,
  orientPreviewToAxis,
  handlePreviewDoubleClick,
  resetPreviewViewToFit,
  resizeRenderer,
} = createTwinPreviewControlActions(previewControlsContext);

const previewLifecycleContext: TwinPreviewLifecycleContext = {
  state,
  scene,
  elements,
  initialBAxisRotationRad: INITIAL_B_AXIS_ROTATION_RAD,
  initialCAxisRotationRad: INITIAL_C_AXIS_ROTATION_RAD,
  fitPreviewToObject,
  capturePreviewViewState,
  renderAxisViewButtons,
  requestPreviewOverlayUpdate,
  requestPreviewRender,
};

const { applyPreviewGroup } = createTwinPreviewLifecycleActions(
  previewLifecycleContext,
);

/**
 * syncPreview は runtime actions 生成後に本体が決まる。
 *
 * refactor で const 化した結果、form UI wiring から先に参照されて TDZ が出たため、
 * ここでは一旦薄い委譲関数を置いて初期化順を安定させる。
 */
let syncPreviewImpl = async () => undefined;
async function syncPreview() {
  return syncPreviewImpl();
}

/** preset / form / face table の描画 helper 群。 */
const {
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
  renderFormValues,
} = createPageUiActions({
  state,
  elements,
  formatCrystalTabLabel,
  formatCrystalUiLabel,
  buildFaceIndexText,
  getActiveCrystalIndex,
  getActiveCrystal,
  getEditableCrystalIndex,
  closeTabMenuPopover,
  applyPresetMetadataSectionVisibility,
  updatePresetMetadataOverlay,
  renderAxisViewButtons,
  renderFaceRows,
  setCrystalVisibilityDefaults,
  syncPreview,
  syncFaceSectionCardHeight,
  resetPreviewViewToFit,
  isCrystalVisible,
});

/** Pointer / wheel / control change の基礎イベントは entry で保持する。 */
controls.addEventListener("change", () => {
  if (state.previewRoot) {
    state.previewViewState = capturePreviewViewState();
    if (state.isPreviewDragging || state.previewInertiaActive) {
      state.previewInertiaLastChangeAt = performance.now();
    }
    requestPreviewRender();
    requestPreviewOverlayUpdate();
    syncXrayFaceOverlayVisibility();
  }
});

elements.canvas.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "touch") {
    if (activePreviewTouchPointerIds.size === 0) {
      previewTouchGestureUsedMultitouch = false;
    }
    activePreviewTouchPointerIds.add(event.pointerId);
    if (activePreviewTouchPointerIds.size >= 2) {
      previewTouchGestureUsedMultitouch = true;
    }
  }
  state.previewInertiaActive = false;
  state.previewInertiaStartedAt = 0;
  state.isPreviewDragging = true;
  state.previewDragButton = event.pointerType === "touch" ? null : event.button;
  applyLabelLayerVisibility();
  syncXrayFaceOverlayVisibility();
  requestPreviewRender();
});

window.addEventListener("pointerup", (event) => {
  if (event.pointerType === "touch") {
    activePreviewTouchPointerIds.delete(event.pointerId);
    if (activePreviewTouchPointerIds.size > 0) {
      return;
    }
  }
  if (!state.isPreviewDragging) {
    return;
  }
  const dragButton = state.previewDragButton;
  state.isPreviewDragging = false;
  state.previewDragButton = null;
  if (
    state.useInertia &&
    ((event.pointerType === "touch" && !previewTouchGestureUsedMultitouch) ||
      (event.pointerType !== "touch" && dragButton === 0))
  ) {
    state.previewInertiaActive = true;
    state.previewInertiaStartedAt = performance.now();
    state.previewInertiaLastChangeAt = state.previewInertiaStartedAt;
  }
  if (event.pointerType === "touch") {
    previewTouchGestureUsedMultitouch = false;
  }
  applyLabelLayerVisibility();
  syncXrayFaceOverlayVisibility();
  requestPreviewOverlayUpdate();
  requestPreviewRender();
});

window.addEventListener("pointercancel", (event) => {
  if (event.pointerType === "touch") {
    activePreviewTouchPointerIds.delete(event.pointerId);
    if (activePreviewTouchPointerIds.size > 0) {
      return;
    }
  }
  if (!state.isPreviewDragging) {
    return;
  }
  state.isPreviewDragging = false;
  state.previewDragButton = null;
  state.previewInertiaActive = false;
  state.previewInertiaStartedAt = 0;
  if (event.pointerType === "touch") {
    previewTouchGestureUsedMultitouch = false;
  }
  applyLabelLayerVisibility();
  syncXrayFaceOverlayVisibility();
  requestPreviewOverlayUpdate();
  requestPreviewRender();
});

elements.canvas.addEventListener("dblclick", handlePreviewDoubleClick);
elements.canvas.addEventListener(
  "wheel",
  () => {
    requestPreviewOverlayUpdate();
    syncXrayFaceOverlayVisibility();
    requestPreviewRender();
  },
  { passive: true },
);

const previewAmbientLight = new THREE.AmbientLight(0xffffff, 1.25);
const previewKeyLight = new THREE.DirectionalLight(0xffffff, 1.35);
previewKeyLight.position.set(8, 12, 10);
const previewFillLight = new THREE.DirectionalLight(0xffffff, 0.72);
previewFillLight.position.set(-12, -5, -9);
scene.add(previewAmbientLight, previewKeyLight, previewFillLight);

const previewLightingContext: TwinPreviewLightingContext = {
  previewAmbientLight,
  previewKeyLight,
  previewFillLight,
};

const { applyPreviewLightingMode } = createTwinPreviewLightingActions(
  previewLightingContext,
);

/** export surface / geometry / format builder は preview 依存順で初期化する。 */
const previewExportSurfaceContext: TwinPreviewExportSurfaceContext = {
  state,
  camera,
  raycaster,
  previewAmbientLight,
  previewKeyLight,
  previewFillLight,
  buildPreviewBoundsSphere,
  getVisibleCrystalEntriesForExport,
  getTwinCrystals,
  getTwinCrystalFaces,
  buildTwinFaceGroupPalette,
  getCrystalAccentColor,
  buildDisplayGeometry,
  buildFlatFaceColors,
  projectWorldPointToExport,
  getExportMaterial,
  hasNamedAncestor,
  resolveXrayPreviewFaceColor,
  isXrayFaceDisplayMode,
};

const {
  shouldUseVectorCrystalBodyForSvgExport,
  hasVisibleContactTwinForSvgExport,
  shouldMergeVectorSvgBodyFacesForExport,
  applyPreviewLightingToSvgFill,
  averageColors,
  createPreviewExportColorResolver,
  getExportSurfaceData,
  collectTransparentXrayExportTriangles,
} = createTwinPreviewExportSurfaceActions(previewExportSurfaceContext);

const previewExportGeometryContext: TwinPreviewExportGeometryContext = {
  state,
  camera,
  svgVectorBodyWorkLongEdge: SVG_VECTOR_BODY_WORK_LONG_EDGE,
  getVisibleCrystalEntriesForExport,
  projectWorldPointToExport,
  hasNamedAncestor,
  getExportMaterial,
  collectVisibleWorldLineSegments,
  buildPreviewExportOcclusionMesh,
  isWorldLinePointVisibleForExport,
  getClosestOpaqueTriangleDepth,
  isXrayFaceDisplayMode,
  createPreviewExportColorResolver,
  applyPreviewLightingToSvgFill,
  collectTransparentXrayExportTriangles,
  getCrystalAccentColor,
  averageColors,
  buildPlaneBasis,
  projectFaceVerticesToPlane,
  buildCrossCrystalIntersectionLinePositions,
  buildIntersectionSegments,
  collectRidgeSplitParameters,
  buildOutlineSegmentKey,
  buildIntersectionLinePoint,
  clipLineToConvexFace,
};

const { collectPreviewExportPolygons, collectPreviewExportLines } =
  createTwinPreviewExportGeometryActions(previewExportGeometryContext);

const previewExportContext: TwinPreviewExportContext = {
  state,
  elements,
  renderer,
  scene,
  camera,
  requestPreviewRender,
  hasNamedAncestor,
  getExportSurfaceData,
  collectPreviewExportPolygons,
  collectPreviewExportLines,
  getPreviewTextOverlays,
  shouldMergeVectorSvgBodyFacesForExport,
  hasVisibleContactTwinForSvgExport,
};

const {
  buildPreviewExportSvg,
  buildPreviewRasterBackedSvg,
  buildPreviewPngBlob,
  buildPreviewJpegBlob,
} = createTwinPreviewExportActions(previewExportContext);

const xrayOverlayContext: TwinXrayOverlayContext = {
  state,
  previewStage: elements.previewStage,
  xrayFaceCanvas: elements.xrayFaceCanvas,
  isPreviewRotating,
  shouldUseScreenSpaceXrayFaceOverlay,
  getVisibleCrystalEntriesForExport,
  getSourceFacesForCrystalIndex: (crystalIndex) =>
    getTwinCrystalFaces(state.parameters, crystalIndex),
  resolveXrayPreviewFaceColor,
  projectWorldPointToExport,
  getXrayPreviewFaceOpacity,
  hasNamedAncestor,
  getExportSurfaceData,
  collectTransparentXrayExportTriangles,
  collectPreviewExportLines,
};

const {
  syncXrayFaceOverlayVisibility,
  applyXrayOverlaySceneVisibility,
  renderScreenSpaceXrayFaceOverlay,
} = createTwinXrayOverlayActions(xrayOverlayContext);

/** 実際の download 実行は exportActions へ閉じ込める。 */
const { exportTwinArtifact } = createTwinExportActions({
  state,
  getVisibleCrystalIndexes,
  buildPreviewExportSvg,
  buildPreviewRasterBackedSvg,
  buildPreviewPngBlob,
  buildPreviewJpegBlob,
  shouldUseVectorCrystalBodyForSvgExport,
  alert: (message) => window.alert(message),
});

const {
  downloadPreviewDebugSnapshot,
  setPreview,
  syncPreview: runtimeSyncPreview,
} = createTwinPreviewRuntimeActions({
  state,
  previewBuildRequestRef,
  loadTwinMeshDataBuilder,
  applyPreviewLightingMode,
  buildPreviewGroup,
  applyPreviewGroup,
  syncXrayFaceOverlayVisibility,
  requestPreviewRender,
  renderMessages,
  renderStats,
  getCrystalAccentColor,
  t,
});
syncPreviewImpl = runtimeSyncPreview;

const { appendDerivedCrystal, deleteCrystalAtIndex } =
  createTwinCrystalMutationActions({
    state,
    commitParameters,
    renderFormValues: () => renderFormValues(),
    syncPreview,
    confirm: (message) => window.confirm(message),
    t,
  });

/**
 * 面一覧本体を再描画する。
 *
 * ここは不具合修正が多かった領域なので、row markup・collapse 状態・等価面生成可否の
 * 判定を helper に逃がしつつ、既存の `data-*` 契約は維持している。
 */
function renderFaceRows() {
  // 面一覧の行内操作で見せる日本語:
  // 「面を表示 / 展開 / 折りたたむ / 文字 / 閉じる / 刻印文字 /
  //  フォント / 文字サイズ / 深さ / 横位置 / 縦位置 / 回転角 /
  //  色 / 等価な面を作成 / 面を全削除 / 削除」
  const faceTableWrap = elements.faceTableWrap;
  const activeElement = document.activeElement;
  const preservedFocusedField =
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLSelectElement
      ? (() => {
          const row = activeElement.closest("[data-face-id]");
          const faceId = row?.getAttribute("data-face-id");
          const faceField = activeElement.dataset.faceField;
          const faceTextField = activeElement.dataset.faceTextField;
          if (!faceId || (!faceField && !faceTextField)) {
            return null;
          }
          return {
            faceId,
            faceField: faceField ?? null,
            faceTextField: faceTextField ?? null,
            source:
              activeElement.closest("#app-face-mobile-list") instanceof
              HTMLElement
                ? "mobile"
                : "table",
            selectionStart:
              activeElement instanceof HTMLInputElement &&
              activeElement.type === "text"
                ? activeElement.selectionStart
                : null,
            selectionEnd:
              activeElement instanceof HTMLInputElement &&
              activeElement.type === "text"
                ? activeElement.selectionEnd
                : null,
          };
        })()
      : null;
  const preservedScrollPosition =
    faceTableWrap instanceof HTMLElement
      ? {
          left: faceTableWrap.scrollLeft,
          top: faceTableWrap.scrollTop,
        }
      : null;
  if (preservedFocusedField?.faceTextField) {
    state.faceTextEditorsExpanded = {
      ...state.faceTextEditorsExpanded,
      [preservedFocusedField.faceId]: true,
    };
  }
  const useFourAxis = usesFourAxisMiller(state.parameters.crystalSystem);
  const editableFaces = getEditableFaces();
  document
    .querySelector("#app-clear-faces-button")
    ?.toggleAttribute("disabled", editableFaces.length === 0);
  elements.faceMobileToolbar
    ?.querySelector<HTMLElement>('[data-mobile-face-action="clear"]')
    ?.toggleAttribute("disabled", editableFaces.length === 0);
  const editableCrystalIndex = getEditableCrystalIndex();
  const { groups, collapsedFaceGroups } = buildTwinFaceDisplayGroupsAndState({
    editableFaces,
    crystalSystem: state.parameters.crystalSystem,
    collapsedFaceGroups: state.collapsedFaceGroups,
    editableCrystalIndex,
    faceGroupStateSeparator: FACE_GROUP_STATE_SEPARATOR,
    getEquivalentFaceGroupKey,
    faceSort: state.faceSort,
    compareFaceItemsForSort: compareTwinFaceItemsForSort,
  });
  state.collapsedFaceGroups = collapsedFaceGroups;
  const { groupColors } = buildTwinFaceGroupPalette(
    editableFaces,
    state.parameters.crystalSystem,
    { getEquivalentFaceGroupKey },
  );

  elements.facesTableBody.replaceChildren();
  elements.faceMobileList?.replaceChildren();
  const tableFragment = document.createDocumentFragment();
  const mobileFragment = document.createDocumentFragment();
  const labels = {
    showFaceTitle: t("faceList.showFaceTitle"),
    expand: t("common.expand"),
    collapse: t("common.collapse"),
    faceTextToggleOpen: t("faceText.toggleOpen"),
    faceTextToggleClose: t("faceText.toggleClose"),
    coefficient: t("common.coefficient"),
    faceTextContent: t("faceText.content"),
    faceTextFont: t("faceText.font"),
    faceTextFontSize: t("faceText.fontSize"),
    faceTextDepth: t("faceText.depth"),
    faceTextOffsetU: t("faceText.offsetU"),
    faceTextOffsetV: t("faceText.offsetV"),
    faceTextRotation: t("faceText.rotation"),
    color: t("crystals.colorLabel"),
    createEquivalentFace: t("common.createEquivalentFace"),
    deleteAllFaces: t("common.deleteAllFaces"),
    delete: t("common.delete"),
    increaseField: (label) => t("common.increaseField", { label }),
    decreaseField: (label) => t("common.decreaseField", { label }),
    sortAscending: (label) => t("common.sortAscending", { label }),
    sortDescending: (label) => t("common.sortDescending", { label }),
  };
  groups.forEach((group) => {
    const groupColor =
      groupColors.get(group.key) ?? createFaceGroupColor(group.key);
    const renderPlan = buildTwinFaceGroupRenderPlan(
      group,
      state.collapsedFaceGroups[getFaceGroupStateKey(group.key)],
    );
    renderPlan.visibleItems.forEach((item, visibleIndex) => {
      const missingEquivalentFaces = createMissingEquivalentFaces(
        editableFaces,
        item.face,
        state.parameters.crystalSystem,
      );
      const isCollapsedRepresentative =
        renderPlan.collapsed && group.items.length > 1 && visibleIndex === 0;
      const rowColor =
        !isCollapsedRepresentative &&
        normalizeFaceAccentColor(item.face.accentColor)
          ? createFaceColorSetFromHex(item.face.accentColor)
          : groupColor;
      const rowOptions = {
        groupKey: group.key,
        groupItemCount: group.items.length,
        groupColor: rowColor,
        item: {
          index: item.index,
          face: {
            id: item.face.id,
            h: item.face.h,
            k: item.face.k,
            i: item.face.i,
            l: item.face.l,
            coefficient: item.face.coefficient,
            enabled: isFaceEnabled(item.face),
            accentColor: item.face.accentColor,
            draftEmptyFields: getDraftEmptyFields(item.face),
            text: item.face.text,
          },
        },
        useFourAxis,
        collapsed: renderPlan.collapsed,
        textExpanded: Boolean(state.faceTextEditorsExpanded[item.face.id]),
        isCollapsedRepresentative,
        isGroupStart: visibleIndex === 0,
        canCreateEquivalentFace:
          !isDraftFace(item.face) && missingEquivalentFaces.length > 0,
        labels,
      } as const;
      tableFragment.append(createTwinFaceRowElement(rowOptions));
      mobileFragment.append(createTwinFaceMobileCardElement(rowOptions));
      if (!isCollapsedRepresentative) {
        tableFragment.append(
          createTwinFaceTextRowElement({
            ...rowOptions,
            isCollapsedRepresentative: false,
            isGroupStart: false,
          }),
        );
      }
    });
  });
  elements.facesTableBody.append(tableFragment);
  elements.faceMobileList?.append(mobileFragment);
  applyControlHelpAttributes(document);
  if (preservedFocusedField) {
    const escapedFaceId = CSS.escape(preservedFocusedField.faceId);
    const targetSelector = preservedFocusedField.faceTextField
      ? `[data-face-id="${escapedFaceId}"] [data-face-text-field="${preservedFocusedField.faceTextField}"]`
      : `[data-face-id="${escapedFaceId}"] [data-face-field="${preservedFocusedField.faceField}"]`;
    const focusRoot =
      preservedFocusedField.source === "mobile"
        ? elements.faceMobileList
        : elements.facesTableBody;
    const nextFocusedField = focusRoot?.querySelector(targetSelector);
    if (
      nextFocusedField instanceof HTMLInputElement ||
      nextFocusedField instanceof HTMLSelectElement
    ) {
      nextFocusedField.focus({ preventScroll: true });
      if (
        nextFocusedField instanceof HTMLInputElement &&
        nextFocusedField.type === "text"
      ) {
        const selectionStart = preservedFocusedField.selectionStart;
        const selectionEnd = preservedFocusedField.selectionEnd;
        if (selectionStart !== null && selectionEnd !== null) {
          nextFocusedField.setSelectionRange(selectionStart, selectionEnd);
        }
      }
    }
  }
  if (preservedScrollPosition && faceTableWrap instanceof HTMLElement) {
    faceTableWrap.scrollLeft = preservedScrollPosition.left;
    faceTableWrap.scrollTop = preservedScrollPosition.top;
    requestAnimationFrame(() => {
      faceTableWrap.scrollLeft = preservedScrollPosition.left;
      faceTableWrap.scrollTop = preservedScrollPosition.top;
    });
  }
}

/** 数値入力欄の暫定値を検証し、確定できるときだけ callback へ渡す。 */
function commitNumericInput(rawValue, onCommit) {
  const trimmed = String(rawValue).trim();
  if (
    trimmed === "" ||
    trimmed === "-" ||
    trimmed === "." ||
    trimmed === "-."
  ) {
    return;
  }

  const numeric = Number(trimmed);
  if (!Number.isFinite(numeric)) {
    return;
  }

  onCommit(numeric);
}

/**
 * parameter mutator を適用して正規化し、フォームと preview をまとめて同期する。
 *
 * twin page の state 更新はこの経路を基本にし、presetId の `custom` 化もここで揃える。
 */
function commitParameters(mutator, options = {}) {
  const next = structuredClone(state.parameters);
  mutator(next);
  const normalized = normalizeTwinParameters(next);
  if (options.markCustom !== false) {
    normalized.presetId = "custom";
  }
  state.parameters = normalized;
  state.stlSplit = normalizeTwinStlSplitSettings(
    state.stlSplit,
    normalized.crystalSystem,
  );
  renderFormValues({
    preserveTabMenu: options.preserveTabMenu === true,
  });
  void syncPreview();
}

/** 分割 STL の作業設定だけを更新し、フォームと preview を同期する。 */
function commitStlSplit(mutator) {
  const next = structuredClone(state.stlSplit);
  mutator(next);
  state.stlSplit = normalizeTwinStlSplitSettings(
    next,
    state.parameters.crystalSystem,
  );
  renderFormValues({ preserveTabMenu: true });
  void syncPreview();
}

/** preset metadata の 1 項目を更新し、overlay 表示も即時に同期する。 */
function commitMetadataField(fieldName: TwinMetadataFieldName, value: string) {
  commitTwinPresetMetadataField(
    state.parameters,
    fieldName,
    String(value ?? ""),
    getCurrentLocale(),
  );
  updatePresetMetadataOverlay();
}

/** 指定結晶の accent 色を更新し、タブ色と preview の両方へ反映する。 */
function updateCrystalAccentColor(crystalIndex: number, accentColor: string) {
  commitParameters(
    (next) => {
      const crystal = getTwinCrystal(next, crystalIndex);
      if (!crystal) {
        return;
      }
      crystal.accentColor = accentColor;
    },
    { preserveTabMenu: true },
  );
}

const { registerPresetAndMetadataHandlers, registerHeaderSaveHandlers } =
  createTwinUiHandlers({
    state,
    elements,
    findPresetFromQuery,
    applyCustomPresetSelection,
    applyTwinPreset,
    syncPresetInputUi,
    openPresetPopup,
    closePresetPopup,
    closeHeaderSaveMenus,
    toggleHeaderSaveMenu,
    openAnnouncementModal: () => openAnnouncement(),
    openManualModal: () => openManual(),
    setMobileLayoutTab: (tab) => {
      setActiveMobileLayoutTab(tab);
      elements.mobileLayoutTabs?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    triggerImportJsonWithMode,
    setLocale: (locale) => {
      if (!(elements.localeSelect instanceof HTMLSelectElement)) {
        return;
      }
      elements.localeSelect.value = locale;
      elements.localeSelect.dispatchEvent(
        new Event("change", { bubbles: true }),
      );
    },
    commitMetadataField,
    applyPresetMetadataSectionVisibility,
    exportTwinArtifact,
  });

const { registerCrystalConfigHandlers, registerCrystalTabHandlers } =
  createTwinCrystalConfigHandlers({
    state,
    elements,
    commitNumericInput,
    commitParameters,
    commitStlSplit,
    getActiveCrystalIndex,
    renderFormValues,
    syncPreview,
    updateCrystalAccentColor,
    appendDerivedCrystal,
    deleteCrystalAtIndex,
    toggleTabMenuPopover,
    closeTabMenuPopover,
    closeHeaderSaveMenus,
  });

const {
  registerFaceTableHeaderHandlers,
  registerFaceTableInputHandlers,
  registerFaceTableClickHandlers,
} = createTwinFaceTableHandlers({
  state,
  elements,
  emptyDraftFaceFields: EMPTY_DRAFT_FACE_FIELDS,
  commitParameters,
  commitNumericInput,
  getEditableCrystalIndex,
  getEditableFaces,
  getTwinCrystalFaces,
  setTwinCrystalFaces,
  createEmptyDraftFace,
  normalizeFaceForSystem,
  getEquivalentFaceGroupKey,
  getDraftEmptyFields,
  getNextCoefficientValue,
  getFaceGroupStateKey,
  renderFaceTableHeader,
  renderFaceRows,
  confirm: (message) => window.confirm(message),
  t,
});

const { registerPreviewToggleHandlers, registerPreviewImportHandlers } =
  createTwinPreviewHandlers({
    state,
    elements,
    controls,
    orientPreviewToAxis,
    applyAxisGuideVisibility,
    applyLabelLayerVisibility,
    requestPreviewOverlayUpdate,
    setPreview,
    isCrystalVisible,
    applyPreviewHelperVisibility,
    updatePresetMetadataOverlay,
    resetPreviewViewToFit,
    downloadPreviewDebugSnapshot,
    renderFormValues,
    syncPreview,
    alert: (message) => window.alert(message),
    t,
  });

const { animate, init } = createPageLifecycleActions({
  state,
  elements,
  previewInertiaIdleTimeoutMs: PREVIEW_INERTIA_IDLE_TIMEOUT_MS,
  previewInertiaMaxDurationMs: PREVIEW_INERTIA_MAX_DURATION_MS,
  initializeLocale,
  setupLocaleSelect,
  onLocaleChange,
  getPresetLabelById,
  applyStaticTranslations,
  renderCrystalSystemOptions,
  renderPresetOptions,
  renderFormValues: () => renderFormValues(),
  syncFaceSectionCardHeight,
  syncPreview,
  loadFaceTextFonts,
  hasAnyFaceTextContent: () => hasAnyFaceTextContent(),
  loadRealTrackballControls,
  controlsHandleResize: () => controls.handleResize(),
  fitPreviewToObject,
  capturePreviewViewState,
  requestPreviewOverlayUpdate,
  requestPreviewRender,
  applyLabelLayerVisibility,
  syncXrayFaceOverlayVisibility,
  animateFrame: () => requestAnimationFrame(animate),
  resizeRenderer,
  attachHandlers: () => {
    registerPresetAndMetadataHandlers();
    registerCrystalConfigHandlers();
    registerCrystalTabHandlers();
    registerFaceTableHeaderHandlers();
    registerFaceTableInputHandlers();
    registerFaceTableClickHandlers();
    registerPreviewToggleHandlers();
    registerHeaderSaveHandlers();
    registerPreviewImportHandlers();
  },
  performanceNow: () => performance.now(),
  isPreviewRotating,
  controlsUpdate: () => controls.update(),
  updateXrayTransparentFaceRenderOrder,
  shouldUseScreenSpacePreviewOverlay,
  applyXrayOverlaySceneVisibility,
  renderScene: () => {
    updateRotationCenterDebugMarker();
    renderer.render(scene, camera);
  },
  renderScreenSpaceXrayFaceOverlay,
  updateFaceLabelOverlay,
});

init();
initMobileLayout();
initAnnouncementModal();
initManualModal();
setupHelpTooltip();

// @ts-nocheck
