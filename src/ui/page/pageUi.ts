import { usesFourAxisMiller } from "../../constants.js";
import {
  applyTwinPresetMetadataOverlay,
  applyTwinPresetMetadataSectionVisibility,
  buildTwinPresetMetadataViewModel,
} from "../preset/presetMetadata.js";

/**
 * 小さな UI 描画 helper をまとめる module。
 *
 * 軸ビュー button、preset metadata、validation message、face list scroll のような
 * 「ページ UI だが大きな state 遷移ではない」処理をここへ寄せる。
 *
 * 主に扱う日本語文言:
 * - 詳細表示 / 折り畳み
 * - 入力値は現在の条件では有効です。
 */

interface PageUiStateLike {
  parameters: {
    name?: unknown;
  };
  previewStyleSettings: {
    presetMetadataName: {
      color: string;
      fontFamily: string;
      fontSizePx: number;
    };
    presetMetadataDescription: {
      color: string;
      fontFamily: string;
      fontSizePx: number;
    };
  };
  showPresetMetadata: boolean;
  presetMetadataExpanded: boolean;
  buildResult: {
    validation?: {
      errors?: string[];
      warnings?: string[];
    };
  } | null;
  activeFaceCrystalIndex: number;
}

interface PageUiElementsLike {
  axisViewButtons: HTMLElement | null;
  presetMetadataOverlay: HTMLElement;
  presetMetadataName: HTMLElement;
  presetMetadataShortDescription: HTMLElement;
  presetMetadataAdvanced: HTMLElement;
  presetMetadataToggleButton: HTMLButtonElement;
  faceTableWrap: HTMLElement;
  facesTableBody: HTMLElement;
  messagesPanel: HTMLElement;
}

export interface PageUiContext {
  state: PageUiStateLike;
  elements: PageUiElementsLike;
  getPreviewAxisGuides: () => { label?: string }[];
  getCurrentLocale: () => string;
  t: (key: string, params?: Record<string, string>) => string;
  getEditableCrystalIndex: () => number;
  renderFormValues: () => void;
}

/** UI の小さな描画 action 群を返す。 */
export function createPageUiHelpers(context: PageUiContext) {
  function getFaceTableHeaderOffset() {
    const headerElement =
      context.elements.facesTableBody
        .closest("table")
        ?.querySelector("thead") ?? null;
    if (!(headerElement instanceof HTMLElement)) {
      return 0;
    }
    return headerElement.offsetHeight + 8;
  }

  /** 軸方向から見るボタン列を現在の結晶系に合わせて組み立てる。 */
  function renderAxisViewButtons() {
    const axisGuides = context.getPreviewAxisGuides();
    if (!context.elements.axisViewButtons) {
      return;
    }

    context.elements.axisViewButtons.replaceChildren();
    if (axisGuides.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    axisGuides.forEach((axis) => {
      const button = document.createElement("button");
      button.className = "preview-axis-view-button";
      button.type = "button";
      button.dataset.axisLabel = String(axis.label ?? "");
      button.textContent = String(axis.label ?? "");
      fragment.append(button);
    });
    context.elements.axisViewButtons.append(fragment);
  }

  /** プレビュー左上の preset metadata overlay を現在 state から更新する。 */
  function updatePresetMetadataOverlay() {
    applyTwinPresetMetadataOverlay(
      {
        overlay: context.elements.presetMetadataOverlay,
        name: context.elements.presetMetadataName,
        shortDescription: context.elements.presetMetadataShortDescription,
      },
      buildTwinPresetMetadataViewModel(
        context.state.parameters,
        context.getCurrentLocale() as "ja" | "en",
      ),
      context.state.showPresetMetadata,
    );
    context.elements.presetMetadataName.style.color =
      context.state.previewStyleSettings.presetMetadataName.color;
    context.elements.presetMetadataName.style.fontFamily =
      context.state.previewStyleSettings.presetMetadataName.fontFamily;
    context.elements.presetMetadataName.style.fontSize = `${context.state.previewStyleSettings.presetMetadataName.fontSizePx}px`;
    context.elements.presetMetadataShortDescription.style.color =
      context.state.previewStyleSettings.presetMetadataDescription.color;
    context.elements.presetMetadataShortDescription.style.fontFamily =
      context.state.previewStyleSettings.presetMetadataDescription.fontFamily;
    context.elements.presetMetadataShortDescription.style.fontSize = `${context.state.previewStyleSettings.presetMetadataDescription.fontSizePx}px`;
  }

  /** preset 情報カードの詳細欄の開閉状態を反映する。 */
  function applyPresetMetadataSectionVisibility() {
    applyTwinPresetMetadataSectionVisibility(
      {
        advanced: context.elements.presetMetadataAdvanced,
        toggleButton: context.elements.presetMetadataToggleButton,
      },
      context.state.presetMetadataExpanded,
      {
        more: context.t("preset.metadataToggle.more"),
        less: context.t("preset.metadataToggle.less"),
      },
    );
  }

  /** preview で選んだ面に対応する face list 行までスクロールする。 */
  function scrollFaceListToMatch(
    faceId: string | null,
    groupKey: string | null,
  ) {
    const wrap = context.elements.faceTableWrap;
    if (!wrap) {
      return;
    }

    const escapedFaceId = faceId ? CSS.escape(String(faceId)) : null;
    const escapedGroupKey = groupKey ? CSS.escape(String(groupKey)) : null;
    const targetRow =
      (escapedFaceId &&
        context.elements.facesTableBody.querySelector(
          `tr[data-face-id="${escapedFaceId}"]`,
        )) ||
      (escapedGroupKey &&
        context.elements.facesTableBody.querySelector(
          `tr[data-group-key="${escapedGroupKey}"]`,
        ));

    if (!targetRow) {
      return;
    }

    const rowTop = (targetRow as HTMLElement).offsetTop;
    const headerOffset = getFaceTableHeaderOffset();
    const maxTop = Math.max(0, wrap.scrollHeight - wrap.clientHeight);
    const nextTop = Math.min(Math.max(0, rowTop - headerOffset), maxTop);
    wrap.scrollTo({
      top: nextTop,
      behavior: "smooth",
    });
  }

  /** preview で選んだ面と face list の行を対応付けてハイライト / スクロールする。 */
  function syncFaceListToPreviewFace(
    crystalIndex: number,
    faceId: string | null,
    groupKey: string | null,
  ) {
    if (!Number.isInteger(crystalIndex) || crystalIndex < 0) {
      return;
    }

    const performScroll = () => {
      requestAnimationFrame(() => {
        scrollFaceListToMatch(faceId, groupKey);
      });
    };

    if (context.getEditableCrystalIndex() === crystalIndex) {
      performScroll();
      return;
    }

    context.state.activeFaceCrystalIndex = crystalIndex;
    context.renderFormValues();
    performScroll();
  }

  /** 面指数を文字列化する。面一覧ラベルと select 文言で共通利用する。 */
  function buildFaceIndexText(
    face: { h: number; k: number; i?: number; l: number },
    systemId: string,
  ) {
    const parts = [Number(face.h), Number(face.k)];
    if (usesFourAxisMiller(systemId)) {
      parts.push(Number(face.i));
    }
    parts.push(Number(face.l));
    return parts.join(", ");
  }

  /** メッセージ種別付きの描画用 object を作る。 */
  function createMessage(type: "error" | "warning" | "info", text: string) {
    const element = document.createElement("div");
    element.className = `message ${type}`;
    element.textContent = text;
    return element;
  }

  /** validation / warning メッセージ欄を描画する。 */
  function renderMessages() {
    context.elements.messagesPanel.innerHTML = "";
    const validation = context.state.buildResult?.validation ?? {
      errors: [],
      warnings: [],
    };

    (validation.errors ?? []).forEach((message) => {
      context.elements.messagesPanel.append(createMessage("error", message));
    });
    (validation.warnings ?? []).forEach((message) => {
      context.elements.messagesPanel.append(createMessage("warning", message));
    });

    if (
      (validation.errors?.length ?? 0) === 0 &&
      (validation.warnings?.length ?? 0) === 0
    ) {
      context.elements.messagesPanel.append(
        createMessage("info", context.t("validation.validInput")),
      );
    }
  }

  /** 現状は統計表示を持たないため no-op のまま残している。 */
  function renderStats() {
    return;
  }

  return {
    renderAxisViewButtons,
    updatePresetMetadataOverlay,
    applyPresetMetadataSectionVisibility,
    syncFaceListToPreviewFace,
    buildFaceIndexText,
    renderMessages,
    renderStats,
  };
}
