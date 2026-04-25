/**
 * 双晶設定カードの表示切り替えに必要な DOM 要素群。
 *
 * 双晶タイプにより表示する説明文・指数欄・接触面欄が大きく変わるため、
 * まとめて受け取れるようにして `main.ts` の分岐を薄くしている。
 */
export interface SettingsPanelElements {
  card: HTMLElement;
  note: HTMLElement;
  fields: HTMLElement;
  ruleHeading: HTMLElement;
  ruleFields: HTMLElement;
  ruleIField: HTMLElement;
  axisAngleField: HTMLElement;
  contactFields: HTMLElement;
  baseFaceRefLabel: HTMLElement;
  derivedFaceRefLabel: HTMLElement;
}

/** 双晶設定カードへ適用する表示文言と可視状態。 */
export interface SettingsPanelViewModel {
  noteText: string;
  ruleHeadingText: string;
  baseFaceRefLabelText: string;
  derivedFaceRefLabelText: string;
  showFields: boolean;
  showRuleInputs: boolean;
  showFourAxisRuleIndex: boolean;
  showContactFields: boolean;
}

/**
 * 現在の双晶設定カードの表示状態を DOM に反映する。
 *
 * 入力:
 * - 画面上の関連 DOM
 * - 現在言語に解決済みの文言と表示フラグ
 *
 * 副作用:
 * - `hidden`
 * - `style.display`
 * - 各ラベルの textContent
 * を更新する
 */
export function applySettingsPanelViewModel(
  elements: SettingsPanelElements,
  viewModel: SettingsPanelViewModel,
): void {
  elements.card.hidden = false;
  elements.note.textContent = viewModel.noteText;
  elements.fields.hidden = !viewModel.showFields;
  elements.ruleHeading.hidden = !viewModel.showRuleInputs;
  elements.ruleFields.hidden = !viewModel.showRuleInputs;
  elements.ruleIField.hidden = !viewModel.showFourAxisRuleIndex;
  elements.axisAngleField.hidden = !viewModel.showRuleInputs;
  elements.contactFields.hidden = !viewModel.showContactFields;

  elements.fields.style.display = viewModel.showFields ? "" : "none";
  elements.ruleHeading.style.display = viewModel.showRuleInputs ? "" : "none";
  elements.ruleFields.style.display = viewModel.showRuleInputs ? "" : "none";
  elements.ruleIField.style.display = viewModel.showFourAxisRuleIndex
    ? ""
    : "none";
  elements.axisAngleField.style.display = viewModel.showRuleInputs
    ? ""
    : "none";
  elements.contactFields.style.display = viewModel.showContactFields
    ? ""
    : "none";

  elements.ruleHeading.textContent = viewModel.ruleHeadingText;
  elements.baseFaceRefLabel.textContent = viewModel.baseFaceRefLabelText;
  elements.derivedFaceRefLabel.textContent = viewModel.derivedFaceRefLabelText;
}
