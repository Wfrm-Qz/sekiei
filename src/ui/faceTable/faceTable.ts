/**
 * 面一覧テーブルでソート可能な列。
 *
 * 既存 UI の `data-sort-field` と 1:1 対応しているため、表記変更時は DOM 側も合わせる必要がある。
 */
export type TwinFaceSortField = "#" | "h" | "k" | "i" | "l" | "coefficient";

/** 面一覧テーブルのソート向き。 */
export type TwinFaceSortDirection = "asc" | "desc";

/** 面一覧テーブルの現在ソート状態。 */
export interface TwinFaceSortState {
  field: TwinFaceSortField;
  direction: TwinFaceSortDirection;
}

/** ソートや描画計画を立てる際に必要な、行番号付きの面情報。 */
export interface TwinFaceItem {
  index: number;
  face: {
    h: number;
    k: number;
    i?: number;
    l: number;
    coefficient: number;
  };
}

/** 面一覧ヘッダー部で使う文言群。 */
export interface TwinFaceTableHeaderLabelSet {
  coefficient: string;
  deleteAllFaces: string;
  addFace: string;
  sortAscending: (label: string) => string;
  sortDescending: (label: string) => string;
}

/** 等価面グループの背景色と境界線色。 */
export interface TwinFaceTableGroupColor {
  preview: string;
  background: string;
  border: string;
}

/** 面一覧 1 行のボタンやラベルで使う文言群。 */
export interface TwinFaceRowLabelSet {
  showFaceTitle: string;
  expand: string;
  collapse: string;
  faceTextToggleOpen: string;
  faceTextToggleClose: string;
  coefficient: string;
  faceTextContent: string;
  faceTextFont: string;
  faceTextFontSize: string;
  faceTextDepth: string;
  faceTextOffsetU: string;
  faceTextOffsetV: string;
  faceTextRotation: string;
  color: string;
  createEquivalentFace: string;
  deleteAllFaces: string;
  delete: string;
  sortAscending: (label: string) => string;
  sortDescending: (label: string) => string;
}

/** 面一覧 1 行分の markup を作るために必要な描画入力。 */
export interface TwinFaceRowMarkupOptions {
  groupKey: string;
  groupItemCount: number;
  groupColor: TwinFaceTableGroupColor;
  item: {
    index: number;
    face: {
      id: string;
      h: number;
      k: number;
      i?: number;
      l: number;
      coefficient: number;
      enabled?: boolean;
      accentColor?: string | null;
      draftEmptyFields?: string[];
      text?: {
        content?: string;
        fontId?: string;
        fontSize?: number;
        depth?: number;
        offsetU?: number;
        offsetV?: number;
        rotationDeg?: number;
      };
    };
  };
  useFourAxis: boolean;
  collapsed: boolean;
  textExpanded?: boolean;
  isCollapsedRepresentative: boolean;
  isGroupStart: boolean;
  canCreateEquivalentFace: boolean;
  labels: TwinFaceRowLabelSet;
}

/** 折り畳み対象になる等価面グループ 1 件。 */
export interface TwinFaceDisplayGroup<TFace = TwinFaceItem["face"]> {
  key: string;
  items: {
    index: number;
    face: TFace;
  }[];
}

/** 等価面グループを実際にどう描画するか決めた結果。 */
export interface TwinFaceGroupRenderPlan<TFace = TwinFaceItem["face"]> {
  collapsed: boolean;
  visibleItems: {
    index: number;
    face: TFace;
  }[];
}

/** 等価面グループキー計算に必要な最小限の面 shape。 */
interface TwinEquivalentKeyFace {
  id?: string;
  h: number;
  k: number;
  i?: number;
  l: number;
  draftGroupKey?: string;
}

/** 指定列でソートするための比較用数値を取り出す。 */
export function getTwinFaceSortValue(
  item: TwinFaceItem,
  field: TwinFaceSortField,
): number {
  if (field === "#") {
    return item.index + 1;
  }
  if (field === "coefficient") {
    return Number(item.face.coefficient);
  }
  return Number(item.face[field] ?? 0);
}

import { getEquivalentFaceGroupKey as buildEquivalentFaceGroupKey } from "../../constants.js";
import { FACE_TEXT_DEFAULTS } from "../../constants.js";
import {
  createFaceColorSetFromHex,
  createFaceGroupColor,
  normalizeFaceAccentColor,
} from "../../state/colorHelpers.js";
import { FACE_TEXT_FONTS } from "../../text/fonts.js";

/**
 * 面一覧の行とグループで共通利用する安定ソート関数。
 *
 * 同じ指数値の行が並んだときに順序がフレームごとに揺れないよう、
 * 最後は元 index を tie-break に使う。
 */
export function compareTwinFaceItemsForSort(
  left: TwinFaceItem,
  right: TwinFaceItem,
  field: TwinFaceSortField,
  direction: TwinFaceSortDirection,
): number {
  const leftValue = getTwinFaceSortValue(left, field);
  const rightValue = getTwinFaceSortValue(right, field);
  const multiplier = direction === "desc" ? -1 : 1;
  const delta = leftValue - rightValue;
  if (Math.abs(delta) > 1e-9) {
    return delta * multiplier;
  }
  return (left.index - right.index) * multiplier;
}

/**
 * 面一覧ヘッダーの HTML を返す。
 *
 * ソートボタン・全削除・追加ボタンの `data-*` と class 名は、
 * 既存 handler が参照しているため変更しない。
 */
export function buildTwinFaceTableHeaderMarkup(options: {
  useFourAxis: boolean;
  sort: TwinFaceSortState | null;
  labels: TwinFaceTableHeaderLabelSet;
}): string {
  const sortableHeaders: { label: string; field: TwinFaceSortField }[] = [
    { label: "#", field: "#" },
    { label: "h", field: "h" },
    { label: "k", field: "k" },
    ...(options.useFourAxis ? [{ label: "i", field: "i" as const }] : []),
    { label: "l", field: "l" },
    { label: options.labels.coefficient, field: "coefficient" },
  ];

  return [
    ...sortableHeaders.map(
      ({ label, field }) => `
      <th scope="col">
        <div class="face-table-sort-header">
          <span>${label}</span>
          <span class="face-table-sort-buttons">
            <button
              class="face-table-sort-button ${options.sort?.field === field && options.sort?.direction === "asc" ? "is-active" : ""}"
              type="button"
              data-sort-field="${field}"
              data-sort-direction="asc"
              aria-label="${options.labels.sortAscending(label)}"
            >▲</button>
            <button
              class="face-table-sort-button ${options.sort?.field === field && options.sort?.direction === "desc" ? "is-active" : ""}"
              type="button"
              data-sort-field="${field}"
              data-sort-direction="desc"
              aria-label="${options.labels.sortDescending(label)}"
            >▼</button>
          </span>
        </div>
      </th>`,
    ),
    `
      <th scope="col" class="face-table-header-actions">
        <div class="face-table-header-action-buttons">
          <button id="app-clear-faces-button" type="button">${options.labels.deleteAllFaces}</button>
          <button id="app-add-face-button" type="button">${options.labels.addFace}</button>
        </div>
      </th>
    `,
  ].join("");
}

/**
 * 面一覧の表示 1 行分の HTML を返す。
 *
 * face table は不具合修正が多かった箇所なので、
 * 返す markup は既存の `data-*` 属性・class 名・button 構造を保守上の契約として維持する。
 */
export function buildTwinFaceRowMarkup(
  options: TwinFaceRowMarkupOptions,
): string {
  return createTwinFaceRowElement(options).outerHTML;
}

function buildTwinFaceIndexText(
  face: TwinFaceRowMarkupOptions["item"]["face"],
  useFourAxis: boolean,
) {
  const parts = [String(face.h), String(face.k)];
  if (useFourAxis) {
    parts.push(String(face.i ?? 0));
  }
  parts.push(String(face.l));
  return `(${parts.join(", ")})`;
}

function createFaceNumberInput(fieldName: string, value: string) {
  const input = document.createElement("input");
  input.dataset.faceField = fieldName;
  input.type = "number";
  input.step = "1";
  input.value = value;
  input.setAttribute("value", value);
  return input;
}

function createFaceTextEditorElement(
  options: TwinFaceRowMarkupOptions,
): HTMLDivElement {
  const text = {
    ...FACE_TEXT_DEFAULTS,
    ...(options.item.face.text ?? {}),
  };
  const editor = document.createElement("div");
  editor.className = "face-text-editor";

  const appendField = (
    className: string,
    labelText: string,
    control: HTMLInputElement | HTMLSelectElement,
  ) => {
    const label = document.createElement("label");
    label.className = `face-text-field ${className}`.trim();
    const span = document.createElement("span");
    span.textContent = labelText;
    label.append(span, control);
    editor.append(label);
  };

  const createNumberInput = (
    fieldName: string,
    value: number,
    step = "any",
  ) => {
    const input = document.createElement("input");
    input.type = "number";
    input.step = step;
    input.value = String(value);
    input.dataset.faceTextField = fieldName;
    return input;
  };

  const contentInput = document.createElement("input");
  contentInput.type = "text";
  contentInput.value = text.content;
  contentInput.dataset.faceTextField = "content";
  appendField(
    "face-text-field-content",
    options.labels.faceTextContent,
    contentInput,
  );

  const fontSelect = document.createElement("select");
  fontSelect.dataset.faceTextField = "fontId";
  FACE_TEXT_FONTS.forEach((font) => {
    const option = document.createElement("option");
    option.value = font.id;
    option.textContent = font.label;
    option.selected = font.id === text.fontId;
    fontSelect.append(option);
  });
  appendField("", options.labels.faceTextFont, fontSelect);

  appendField(
    "",
    options.labels.faceTextFontSize,
    createNumberInput("fontSize", text.fontSize),
  );
  appendField(
    "",
    options.labels.faceTextDepth,
    createNumberInput("depth", text.depth),
  );
  appendField(
    "",
    options.labels.faceTextOffsetU,
    createNumberInput("offsetU", text.offsetU),
  );
  appendField(
    "",
    options.labels.faceTextOffsetV,
    createNumberInput("offsetV", text.offsetV),
  );
  appendField(
    "",
    options.labels.faceTextRotation,
    createNumberInput("rotationDeg", text.rotationDeg),
  );

  return editor;
}

/** 面一覧 1 行分の DOM を安全に組み立てる。 */
export function createTwinFaceRowElement(
  options: TwinFaceRowMarkupOptions,
): HTMLTableRowElement {
  const emptyFields = new Set(options.item.face.draftEmptyFields ?? []);
  const hValue = emptyFields.has("h") ? "" : String(options.item.face.h);
  const kValue = emptyFields.has("k") ? "" : String(options.item.face.k);
  const lValue = emptyFields.has("l") ? "" : String(options.item.face.l);
  const iValue =
    emptyFields.has("h") || emptyFields.has("k")
      ? ""
      : String(options.item.face.i ?? "");
  const coefficientValue = emptyFields.has("coefficient")
    ? ""
    : String(options.item.face.coefficient);
  const row = document.createElement("tr");
  row.dataset.faceId = options.item.face.id;
  row.dataset.faceIndex = String(options.item.index);
  row.dataset.groupKey = options.groupKey;
  row.dataset.groupCollapsed = String(options.isCollapsedRepresentative);
  row.className =
    `face-row ${options.isGroupStart ? "face-row-group-start" : ""}`.trim();
  row.style.setProperty(
    "--face-group-background",
    options.groupColor.background,
  );
  row.style.setProperty("--face-group-border", options.groupColor.border);

  const createTd = (...children: HTMLElement[]) => {
    const cell = document.createElement("td");
    children.forEach((child) => cell.append(child));
    return cell;
  };

  const labelCell = document.createElement("td");
  const labelWrap = document.createElement("div");
  labelWrap.className = "face-row-label";

  const rowIndex = document.createElement("span");
  rowIndex.className = "face-row-index";
  rowIndex.textContent = String(options.item.index + 1);
  labelWrap.append(rowIndex);

  const enabledLabel = document.createElement("label");
  enabledLabel.className = "face-enabled-toggle";
  enabledLabel.title = options.labels.showFaceTitle;
  const enabledInput = document.createElement("input");
  enabledInput.dataset.faceField = "enabled";
  enabledInput.type = "checkbox";
  enabledInput.checked = options.item.face.enabled !== false;
  enabledLabel.append(enabledInput);
  labelWrap.append(enabledLabel);

  if (options.groupItemCount > 1 && options.isGroupStart) {
    const toggleButton = document.createElement("button");
    toggleButton.className = "face-group-toggle";
    toggleButton.type = "button";
    toggleButton.dataset.groupKey = options.groupKey;
    toggleButton.setAttribute("aria-expanded", String(!options.collapsed));
    toggleButton.textContent = options.collapsed
      ? options.labels.expand
      : options.labels.collapse;
    labelWrap.append(toggleButton);

    const groupCount = document.createElement("span");
    groupCount.className = "face-group-count";
    groupCount.textContent = String(options.groupItemCount);
    labelWrap.append(groupCount);
  }

  labelCell.append(labelWrap);
  row.append(labelCell);

  const hInput = createFaceNumberInput("h", hValue);
  hInput.disabled = options.isCollapsedRepresentative;
  row.append(createTd(hInput));

  const kInput = createFaceNumberInput("k", kValue);
  kInput.disabled = options.isCollapsedRepresentative;
  row.append(createTd(kInput));

  if (options.useFourAxis) {
    const iInput = createFaceNumberInput("i", iValue);
    iInput.readOnly = true;
    row.append(createTd(iInput));
  }

  const lInput = createFaceNumberInput("l", lValue);
  lInput.disabled = options.isCollapsedRepresentative;
  row.append(createTd(lInput));

  const coefficientCell = document.createElement("td");
  const coefficientWrap = document.createElement("div");
  coefficientWrap.className = "coefficient-input-wrap";
  const coefficientInput = document.createElement("input");
  coefficientInput.className = "coefficient-input";
  coefficientInput.dataset.faceField = "coefficient";
  coefficientInput.type = "number";
  coefficientInput.min = "0";
  coefficientInput.step = "any";
  coefficientInput.value = coefficientValue;
  coefficientInput.setAttribute("value", coefficientValue);
  coefficientWrap.append(coefficientInput);

  const spinButtons = document.createElement("div");
  spinButtons.className = "coefficient-spin-buttons";
  const upButton = document.createElement("button");
  upButton.className = "coefficient-spin-button";
  upButton.type = "button";
  upButton.dataset.spinDirection = "up";
  upButton.setAttribute(
    "aria-label",
    options.labels.sortAscending(options.labels.coefficient),
  );
  upButton.textContent = "▲";
  spinButtons.append(upButton);

  const downButton = document.createElement("button");
  downButton.className = "coefficient-spin-button";
  downButton.type = "button";
  downButton.dataset.spinDirection = "down";
  downButton.setAttribute(
    "aria-label",
    options.labels.sortDescending(options.labels.coefficient),
  );
  downButton.textContent = "▼";
  spinButtons.append(downButton);

  coefficientWrap.append(spinButtons);
  coefficientCell.append(coefficientWrap);
  row.append(coefficientCell);

  const actionsCell = document.createElement("td");
  actionsCell.className = "face-actions";
  const actionsWrap = document.createElement("div");
  actionsWrap.className = "face-action-buttons";

  if (!options.isCollapsedRepresentative) {
    const textToggleButton = document.createElement("button");
    textToggleButton.className = "toggle-face-text-button";
    textToggleButton.type = "button";
    textToggleButton.dataset.faceTextToggle = "true";
    textToggleButton.setAttribute(
      "aria-expanded",
      String(Boolean(options.textExpanded)),
    );
    textToggleButton.textContent = options.textExpanded
      ? options.labels.faceTextToggleClose
      : options.labels.faceTextToggleOpen;
    actionsWrap.append(textToggleButton);

    const equivalentButton = document.createElement("button");
    equivalentButton.className = "equivalent-face-button";
    equivalentButton.type = "button";
    equivalentButton.disabled = !options.canCreateEquivalentFace;
    equivalentButton.textContent = options.labels.createEquivalentFace;
    actionsWrap.append(equivalentButton);
  }

  const colorField = document.createElement("div");
  colorField.className = "face-color-field";
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.dataset.faceField = "accentColor";
  colorInput.value =
    normalizeFaceAccentColor(options.item.face.accentColor) ??
    options.groupColor.preview;
  colorField.append(colorInput);
  actionsWrap.append(colorField);

  const removeButton = document.createElement("button");
  removeButton.className = "remove-face-button";
  removeButton.type = "button";
  removeButton.textContent = options.isCollapsedRepresentative
    ? options.labels.deleteAllFaces
    : options.labels.delete;
  actionsWrap.append(removeButton);

  actionsCell.append(actionsWrap);
  row.append(actionsCell);

  return row;
}

/** 面ごとの文字掘り込み設定行を DOM で組み立てる。 */
export function createTwinFaceTextRowElement(
  options: TwinFaceRowMarkupOptions,
): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.dataset.faceId = options.item.face.id;
  row.dataset.faceIndex = String(options.item.index);
  row.dataset.groupKey = options.groupKey;
  row.className = "face-row face-text-row";
  row.hidden = !options.textExpanded;
  row.style.setProperty(
    "--face-group-background",
    options.groupColor.background,
  );
  row.style.setProperty("--face-group-border", options.groupColor.border);

  const cell = document.createElement("td");
  cell.colSpan = options.useFourAxis ? 7 : 6;
  cell.append(createFaceTextEditorElement(options));
  row.append(cell);
  return row;
}

/** スマホ向けの面カードを DOM で組み立てる。 */
export function createTwinFaceMobileCardElement(
  options: TwinFaceRowMarkupOptions,
): HTMLElement {
  const emptyFields = new Set(options.item.face.draftEmptyFields ?? []);
  const hValue = emptyFields.has("h") ? "" : String(options.item.face.h);
  const kValue = emptyFields.has("k") ? "" : String(options.item.face.k);
  const lValue = emptyFields.has("l") ? "" : String(options.item.face.l);
  const iValue =
    emptyFields.has("h") || emptyFields.has("k")
      ? ""
      : String(options.item.face.i ?? "");
  const coefficientValue = emptyFields.has("coefficient")
    ? ""
    : String(options.item.face.coefficient);

  const card = document.createElement("article");
  card.className = "face-mobile-card";
  card.dataset.faceId = options.item.face.id;
  card.dataset.faceIndex = String(options.item.index);
  card.dataset.groupKey = options.groupKey;
  card.dataset.groupCollapsed = String(options.isCollapsedRepresentative);
  card.style.setProperty(
    "--face-group-background",
    options.groupColor.background,
  );
  card.style.setProperty("--face-group-border", options.groupColor.border);

  const header = document.createElement("div");
  header.className = "face-mobile-card__header";

  const titleWrap = document.createElement("div");
  titleWrap.className = "face-mobile-card__title";
  const titleIndex = document.createElement("span");
  titleIndex.className = "face-mobile-card__title-index";
  titleIndex.textContent = `#${options.item.index + 1}`;
  const titleFace = document.createElement("span");
  titleFace.className = "face-mobile-card__title-face";
  titleFace.textContent = buildTwinFaceIndexText(
    options.item.face,
    options.useFourAxis,
  );
  titleWrap.append(titleIndex, titleFace);

  const headerActions = document.createElement("div");
  headerActions.className = "face-mobile-card__header-actions";
  const enabledLabel = document.createElement("label");
  enabledLabel.className = "face-enabled-toggle";
  enabledLabel.title = options.labels.showFaceTitle;
  const enabledInput = document.createElement("input");
  enabledInput.dataset.faceField = "enabled";
  enabledInput.type = "checkbox";
  enabledInput.checked = options.item.face.enabled !== false;
  enabledLabel.append(enabledInput);
  headerActions.append(enabledLabel);

  if (options.groupItemCount > 1 && options.isGroupStart) {
    const toggleButton = document.createElement("button");
    toggleButton.className = "face-group-toggle";
    toggleButton.type = "button";
    toggleButton.dataset.groupKey = options.groupKey;
    toggleButton.setAttribute("aria-expanded", String(!options.collapsed));
    toggleButton.textContent = options.collapsed
      ? options.labels.expand
      : options.labels.collapse;
    headerActions.append(toggleButton);

    const groupCount = document.createElement("span");
    groupCount.className = "face-group-count";
    groupCount.textContent = String(options.groupItemCount);
    headerActions.append(groupCount);
  }

  header.append(titleWrap, headerActions);
  card.append(header);

  const fieldGrid = document.createElement("div");
  fieldGrid.className = "face-mobile-card__fields";
  const appendField = (
    fieldLabel: string,
    input: HTMLInputElement,
    fieldOptions: {
      disabled?: boolean;
      readOnly?: boolean;
      coefficient?: boolean;
    } = {},
  ) => {
    const label = document.createElement("label");
    label.className = "face-mobile-card__field";
    const span = document.createElement("span");
    span.textContent = fieldLabel;
    label.append(span);
    if (fieldOptions.coefficient) {
      const wrap = document.createElement("div");
      wrap.className = "coefficient-input-wrap";
      input.className = "coefficient-input";
      input.min = "0";
      input.step = "any";
      if (fieldOptions.disabled) {
        input.disabled = true;
      }
      wrap.append(input);

      const spinButtons = document.createElement("div");
      spinButtons.className = "coefficient-spin-buttons";
      const upButton = document.createElement("button");
      upButton.className = "coefficient-spin-button";
      upButton.type = "button";
      upButton.dataset.spinDirection = "up";
      upButton.setAttribute(
        "aria-label",
        options.labels.sortAscending(options.labels.coefficient),
      );
      upButton.textContent = "▲";
      const downButton = document.createElement("button");
      downButton.className = "coefficient-spin-button";
      downButton.type = "button";
      downButton.dataset.spinDirection = "down";
      downButton.setAttribute(
        "aria-label",
        options.labels.sortDescending(options.labels.coefficient),
      );
      downButton.textContent = "▼";
      spinButtons.append(upButton, downButton);
      wrap.append(spinButtons);
      label.append(wrap);
      fieldGrid.append(label);
      return;
    }

    if (fieldOptions.disabled) {
      input.disabled = true;
    }
    if (fieldOptions.readOnly) {
      input.readOnly = true;
    }
    label.append(input);
    fieldGrid.append(label);
  };

  appendField("h", createFaceNumberInput("h", hValue), {
    disabled: options.isCollapsedRepresentative,
  });
  appendField("k", createFaceNumberInput("k", kValue), {
    disabled: options.isCollapsedRepresentative,
  });
  if (options.useFourAxis) {
    appendField("i", createFaceNumberInput("i", iValue), {
      readOnly: true,
    });
  }
  appendField("l", createFaceNumberInput("l", lValue), {
    disabled: options.isCollapsedRepresentative,
  });
  appendField(
    options.labels.coefficient,
    createFaceNumberInput("coefficient", coefficientValue),
    {
      coefficient: true,
    },
  );
  card.append(fieldGrid);

  const actionsWrap = document.createElement("div");
  actionsWrap.className = "face-mobile-card__actions";

  if (!options.isCollapsedRepresentative) {
    const textToggleButton = document.createElement("button");
    textToggleButton.className = "toggle-face-text-button";
    textToggleButton.type = "button";
    textToggleButton.dataset.faceTextToggle = "true";
    textToggleButton.setAttribute(
      "aria-expanded",
      String(Boolean(options.textExpanded)),
    );
    textToggleButton.textContent = options.textExpanded
      ? options.labels.faceTextToggleClose
      : options.labels.faceTextToggleOpen;
    actionsWrap.append(textToggleButton);

    const equivalentButton = document.createElement("button");
    equivalentButton.className = "equivalent-face-button";
    equivalentButton.type = "button";
    equivalentButton.disabled = !options.canCreateEquivalentFace;
    equivalentButton.textContent = options.labels.createEquivalentFace;
    actionsWrap.append(equivalentButton);
  }

  const colorField = document.createElement("div");
  colorField.className = "face-color-field";
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.dataset.faceField = "accentColor";
  colorInput.value =
    normalizeFaceAccentColor(options.item.face.accentColor) ??
    options.groupColor.preview;
  colorField.append(colorInput);
  actionsWrap.append(colorField);

  const removeButton = document.createElement("button");
  removeButton.className = "remove-face-button";
  removeButton.type = "button";
  removeButton.textContent = options.isCollapsedRepresentative
    ? options.labels.deleteAllFaces
    : options.labels.delete;
  actionsWrap.append(removeButton);
  card.append(actionsWrap);

  if (!options.isCollapsedRepresentative && options.textExpanded) {
    const textEditorWrap = document.createElement("div");
    textEditorWrap.className = "face-mobile-card__text-editor";
    textEditorWrap.append(createFaceTextEditorElement(options));
    card.append(textEditorWrap);
  }

  return card;
}

/**
 * 等価面グループを「折り畳むか」「何行見せるか」に変換する。
 *
 * 既存 UI と同じく、複数面グループは初期状態では折り畳み、
 * ユーザーが展開状態を変更した場合のみ `collapsedState` を優先する。
 */
export function buildTwinFaceGroupRenderPlan<TFace>(
  group: TwinFaceDisplayGroup<TFace>,
  collapsedState: boolean | undefined,
): TwinFaceGroupRenderPlan<TFace> {
  const collapsed = collapsedState ?? group.items.length > 1;
  return {
    collapsed,
    visibleItems: collapsed ? [group.items[0]] : group.items,
  };
}

/** 下書き行は等価面 group へ畳まず、一意キーで独立表示する。 */
function resolveTwinFaceGroupKey(
  face: TwinEquivalentKeyFace,
  crystalSystem: string,
  getEquivalentFaceGroupKey: (
    face: TwinEquivalentKeyFace,
    crystalSystem: string,
  ) => string,
) {
  return face?.draftGroupKey || getEquivalentFaceGroupKey(face, crystalSystem);
}

/**
 * 面一覧の editable face 群を等価面 group へ束ね、折り畳み state も整える。
 *
 * handler や描画本体が扱う前段の純粋処理だけをここへ寄せ、UI 契約は呼び出し側に残す。
 */
export function buildTwinFaceDisplayGroupsAndState(options) {
  const {
    editableFaces,
    crystalSystem,
    collapsedFaceGroups,
    editableCrystalIndex,
    faceGroupStateSeparator,
    getEquivalentFaceGroupKey,
    faceSort,
    compareFaceItemsForSort,
  } = options;
  const groups = [];
  const groupMap = new Map();

  editableFaces.forEach((face, index) => {
    const key = resolveTwinFaceGroupKey(
      face,
      crystalSystem,
      getEquivalentFaceGroupKey,
    );
    if (!groupMap.has(key)) {
      const group = { key, items: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    groupMap.get(key).items.push({ face, index });
  });

  const validGroupKeys = new Set(groups.map((group) => group.key));
  const prefix = `${editableCrystalIndex}${faceGroupStateSeparator}`;
  const nextCollapsedFaceGroups = Object.fromEntries(
    Object.entries(collapsedFaceGroups).filter(([key]) => {
      const groupKey = key.startsWith(prefix) ? key.slice(prefix.length) : null;
      return !key.startsWith(prefix) || validGroupKeys.has(groupKey);
    }),
  );

  if (faceSort?.field && faceSort?.direction) {
    groups.forEach((group) => {
      group.items.sort((left, right) =>
        compareFaceItemsForSort(
          left,
          right,
          faceSort.field,
          faceSort.direction,
        ),
      );
    });
    groups.sort((leftGroup, rightGroup) =>
      compareFaceItemsForSort(
        leftGroup.items[0],
        rightGroup.items[0],
        faceSort.field,
        faceSort.direction,
      ),
    );
  }

  return {
    groups,
    collapsedFaceGroups: nextCollapsedFaceGroups,
  };
}

/**
 * 等価面 group ごとの背景色 / preview 色を返す。
 *
 * 既定では `constants.ts` の等価面キー規則を使い、呼び出し側が関数を渡した場合だけ上書きする。
 */
export function buildTwinFaceGroupPalette(
  faces,
  crystalSystem,
  options: {
    getEquivalentFaceGroupKey?: (
      face: TwinEquivalentKeyFace,
      crystalSystem: string,
    ) => string;
  } = {},
) {
  const getEquivalentFaceGroupKey =
    options.getEquivalentFaceGroupKey ??
    ((face, systemId) => buildEquivalentFaceGroupKey(face, systemId));
  const groupColors = new Map();
  const faceColors = new Map();
  const facesByGroupKey = new Map();
  faces.forEach((face) => {
    const key = resolveTwinFaceGroupKey(
      face,
      crystalSystem,
      getEquivalentFaceGroupKey,
    );
    if (!groupColors.has(key)) {
      groupColors.set(key, createFaceGroupColor(key));
    }
    if (!facesByGroupKey.has(key)) {
      facesByGroupKey.set(key, []);
    }
    facesByGroupKey.get(key).push(face);
    const explicitColor = normalizeFaceAccentColor(face.accentColor);
    faceColors.set(
      face.id,
      explicitColor
        ? createFaceColorSetFromHex(explicitColor)
        : groupColors.get(key),
    );
  });
  facesByGroupKey.forEach((groupFaces, key) => {
    // 折り畳み代表行では group 色を color picker の初期値にも使うため、
    // グループ全体が同色指定なら背景・preview 色も明示色へ寄せる。
    const explicitColors = groupFaces
      .map((face) => normalizeFaceAccentColor(face.accentColor))
      .filter(Boolean);
    if (
      explicitColors.length === groupFaces.length &&
      new Set(explicitColors).size === 1
    ) {
      groupColors.set(key, createFaceColorSetFromHex(explicitColors[0]));
    }
  });
  return { groupColors, faceColors };
}
