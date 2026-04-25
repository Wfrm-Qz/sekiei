/**
 * プリセット情報カードと、プレビュー上のメタデータ表示をつなぐ補助をまとめる。
 *
 * 名前の多言語切り替え、編集欄と state の反映、折り畳みセクション表示を
 * 幾何計算ロジックから分離し、`main.ts` の責務を少しずつ薄くする役割を持つ。
 */
import { getLocalizedNameText } from "../../constants.js";

type SupportedLocale = "ja" | "en";
type AlternateLocale = "jp" | "en";

/**
 * プリセット情報カードで編集できるメタデータ項目名。
 *
 * DOM の `data-*` 属性と state 更新処理の両方で同じ名前を使うため、
 * union 型に集約しておくことで、大きなページをリファクタするときのずれを防ぐ。
 */
export type TwinMetadataFieldName =
  | "name"
  | "altName"
  | "shortDescription"
  | "description"
  | "reference"
  | "fullReference";

/**
 * 多言語対応したプリセットメタデータを読み書きするための最小構成。
 *
 * 実際の parameter object にはこれ以外の項目も多く含まれるが、
 * この helper は幾何計算やプレビュー処理から独立させたいため、
 * 必要な部分集合だけを型として切り出している。
 */
export interface TwinPresetMetadataSource {
  name?: {
    jp?: string;
    en?: string;
  } | null;
  shortDescription?: string | null;
  description?: string | null;
  reference?: string | null;
  fullReference?: string | null;
  presetId?: string | null;
}

export interface TwinPresetMetadataInputElements {
  name: HTMLInputElement;
  altName: HTMLInputElement;
  shortDescription: HTMLInputElement;
  description: HTMLTextAreaElement;
  reference: HTMLInputElement;
  fullReference: HTMLTextAreaElement;
}

/** プレビュー左上に出る簡易メタデータ表示に対応する DOM 要素群。 */
export interface TwinPresetMetadataOverlayElements {
  overlay: HTMLElement;
  name: HTMLElement;
  shortDescription: HTMLElement;
}

/** プリセット情報カードの詳細折り畳み部分を制御する DOM 要素群。 */
export interface TwinPresetMetadataSectionElements {
  advanced: HTMLElement;
  toggleButton: HTMLButtonElement;
}

/** 詳細表示トグルの文言セット。 */
export interface TwinPresetMetadataToggleLabels {
  more: string;
  less: string;
}

/** 現在言語に解決済みの、プリセット情報カード表示用テキスト群。 */
export interface TwinPresetMetadataViewModel {
  primaryName: string;
  alternateName: string;
  shortDescription: string;
  description: string;
  reference: string;
  fullReference: string;
}

/** 現在言語から、反対側の名前欄に使うロケールキーを求める。 */
function getAlternateLocale(locale: SupportedLocale): AlternateLocale {
  return locale === "ja" ? "en" : "jp";
}

/**
 * パラメーターから、現在言語向けの表示文言を組み立てる。
 *
 * 入力:
 * - parameters 側に保持しているメタデータ
 * - 現在の UI 言語
 *
 * 出力:
 * - 入力欄とプレビュー overlay にそのまま流し込める文字列群
 */
export function buildTwinPresetMetadataViewModel(
  source: TwinPresetMetadataSource,
  locale: SupportedLocale,
): TwinPresetMetadataViewModel {
  return {
    primaryName: getLocalizedNameText(source.name, locale),
    alternateName: getLocalizedNameText(
      source.name,
      getAlternateLocale(locale),
    ),
    shortDescription: source.shortDescription ?? "",
    description: source.description ?? "",
    reference: source.reference ?? "",
    fullReference: source.fullReference ?? "",
  };
}

/**
 * 現在言語に解決済みのメタデータを、編集フォームに反映する。
 *
 * 副作用:
 * - input / textarea の value を変更する
 */
export function populateTwinPresetMetadataInputs(
  inputs: TwinPresetMetadataInputElements,
  viewModel: TwinPresetMetadataViewModel,
): void {
  inputs.name.value = viewModel.primaryName;
  inputs.altName.value = viewModel.alternateName;
  inputs.shortDescription.value = viewModel.shortDescription;
  inputs.description.value = viewModel.description;
  inputs.reference.value = viewModel.reference;
  inputs.fullReference.value = viewModel.fullReference;
}

/**
 * プレビュー上に重ねる簡易メタデータ表示を更新する。
 *
 * overlay では「現在言語の名前」と「簡易説明」だけを表示する。
 * 詳細説明や出典まで常時載せると視認性を崩すため、ここでは扱わない。
 */
export function applyTwinPresetMetadataOverlay(
  elements: TwinPresetMetadataOverlayElements,
  viewModel: TwinPresetMetadataViewModel,
  showPresetMetadata: boolean,
): void {
  const name = viewModel.primaryName.trim();
  const shortDescription = viewModel.shortDescription.trim();
  const hasContent = name.length > 0 || shortDescription.length > 0;
  const shouldShow = showPresetMetadata && hasContent;

  elements.name.textContent = name;
  elements.shortDescription.textContent = shortDescription;
  elements.name.hidden = name.length === 0;
  elements.shortDescription.hidden = shortDescription.length === 0;
  elements.overlay.hidden = !shouldShow;
  elements.overlay.style.display = shouldShow ? "flex" : "none";
}

/**
 * プリセット情報カードの詳細欄の開閉状態を DOM に反映する。
 *
 * `main.ts` 側が個々の DOM を直接いじらなくてよいよう、
 * 表示状態とボタン文言をここでまとめて適用する。
 */
export function applyTwinPresetMetadataSectionVisibility(
  elements: TwinPresetMetadataSectionElements,
  expanded: boolean,
  labels: TwinPresetMetadataToggleLabels,
): void {
  elements.advanced.hidden = !expanded;
  elements.advanced.style.display = expanded ? "grid" : "none";
  elements.toggleButton.textContent = expanded ? labels.less : labels.more;
  elements.toggleButton.setAttribute(
    "aria-expanded",
    expanded ? "true" : "false",
  );
}

/**
 * 編集欄の内容を parameters state に書き戻す。
 *
 * 副作用:
 * - source を直接更新する
 * - built-in preset と完全一致しなくなるため `presetId` を `custom` に切り替える
 */
export function commitTwinPresetMetadataField(
  source: TwinPresetMetadataSource,
  fieldName: TwinMetadataFieldName,
  value: string,
  locale: SupportedLocale,
): void {
  if (fieldName === "name" || fieldName === "altName") {
    const nextName = {
      jp: String(source.name?.jp ?? ""),
      en: String(source.name?.en ?? ""),
    };
    const targetLocale =
      fieldName === "name"
        ? locale === "ja"
          ? "jp"
          : "en"
        : getAlternateLocale(locale);
    nextName[targetLocale] = String(value ?? "");
    source.name = nextName;
  } else {
    source[fieldName] = String(value ?? "");
  }

  source.presetId = "custom";
}
