/**
 * プリセット検索コンボボックスの描画補助をまとめる。
 *
 * ここでは「候補の絞り込み」「ポップアップの開閉表示」「ARIA 同期」だけを扱う。
 * 実際にプリセットを適用した結果どの state を更新するかは画面ごとに違うため、
 * 適用処理そのものは各 entry file 側に残している。
 */

/** コンボボックス UI が最低限必要とするプリセット候補の形。 */
export interface PresetOptionSummary {
  id: string;
  label: string;
}

/** プリセット検索 UI の開閉状態を同期するために必要な DOM 要素群。 */
export interface PresetComboboxElements {
  input: HTMLInputElement;
  clearButton: HTMLElement;
  toggleButton: HTMLElement;
  popup: HTMLElement;
}

/**
 * 現在の検索文字列で表示対象に残す候補だけを返す。
 *
 * legacy 実装は前方一致ベースだったため、その体感を変えないよう
 * `startsWith` を維持している。
 */
export function filterPresetOptions(
  options: PresetOptionSummary[],
  query: string,
): PresetOptionSummary[] {
  const normalizedQuery = String(query ?? "").trim();
  return options.filter((option) =>
    normalizedQuery === ""
      ? true
      : option.label.startsWith(normalizedQuery) ||
        option.id.startsWith(normalizedQuery),
  );
}

/** 候補一覧から指定 id の表示ラベルを引き当てる。 */
export function getPresetOptionLabel(
  options: PresetOptionSummary[],
  presetId: string,
): string {
  return options.find((option) => option.id === presetId)?.label ?? "";
}

/**
 * 入力欄の自由入力文字列から、選択確定すべき候補を探す。
 *
 * 完全一致を前方一致より優先するのは、短い接頭辞入力で別候補に吸われないようにするため。
 */
export function findPresetOptionFromQuery(
  options: PresetOptionSummary[],
  query: string,
): PresetOptionSummary | null {
  const normalizedQuery = String(query ?? "").trim();
  if (!normalizedQuery) {
    return null;
  }

  const exactMatch = options.find(
    (option) =>
      option.label === normalizedQuery || option.id === normalizedQuery,
  );
  if (exactMatch) {
    return exactMatch;
  }

  return (
    options.find(
      (option) =>
        option.label.startsWith(normalizedQuery) ||
        option.id.startsWith(normalizedQuery),
    ) ?? null
  );
}

/**
 * 入力値・クリアボタン・候補ポップアップ・ARIA 属性をまとめて同期する。
 *
 * 候補の実描画は callback に任せることで、
 * 画面ごとのデータ取得タイミングを壊さずに共通化している。
 */
export function syncPresetComboboxUi(
  elements: PresetComboboxElements,
  query: string,
  popupOpen: boolean,
  renderOptions: () => void,
): void {
  elements.input.value = query;
  elements.clearButton.hidden = query.length === 0;
  elements.popup.hidden = !popupOpen;
  const expanded = popupOpen ? "true" : "false";
  elements.input.setAttribute("aria-expanded", expanded);
  elements.toggleButton.setAttribute("aria-expanded", expanded);

  if (popupOpen) {
    renderOptions();
  }
}

/**
 * 候補ポップアップを作り直し、候補選択時の callback を配線する。
 *
 * callback には preset id だけを渡す。詳細な preset object への解決は
 * 画面ごとに持っている状態管理へ寄せるため、ここでは意図的に扱わない。
 */
export function renderPresetOptionsPopup(params: {
  popup: HTMLElement;
  options: PresetOptionSummary[];
  noMatchesText: string;
  onSelect: (presetId: string) => void;
}): void {
  const { popup, options, noMatchesText, onSelect } = params;
  popup.replaceChildren();

  if (options.length === 0) {
    const empty = document.createElement("div");
    empty.className = "search-input-popup-empty";
    empty.textContent = noMatchesText;
    popup.append(empty);
    return;
  }

  options.forEach((option) => {
    const button = document.createElement("button");
    button.className = "search-input-popup-option";
    button.type = "button";
    button.setAttribute("role", "option");
    button.dataset.presetId = option.id;
    button.textContent = option.label;
    button.addEventListener("mousedown", (event) => {
      event.preventDefault();
      onSelect(option.id);
    });
    popup.append(button);
  });
}
