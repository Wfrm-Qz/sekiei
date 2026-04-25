/**
 * 小さな HTML 断片を組み立てる helper 群。
 *
 * tab や toggle の markup 文字列をまとめておくことで、
 * `main.ts` 側では「どの状態を表示するか」に集中できるようにしている。
 * 既存 handler が依存する class 名 / data 属性はここでも厳密に維持する。
 */
/** `<select>` に差し込む option 1 件分の値。 */
export interface SelectOption {
  value: string;
  label: string;
}

/** 結晶切り替えタブ 1 個分の描画に必要な情報。 */
export interface CrystalTabMarkupOptions {
  index: number;
  label: string;
  isActive: boolean;
  menuAriaLabel: string;
  tabBackground: string;
  tabHoverBackground: string;
  tabActiveBackground: string;
  tabBorder: string;
}

/** 結晶表示 ON/OFF チップ 1 個分の描画情報。 */
export interface CrystalVisibilityToggleOptions {
  index: number;
  label: string;
  checked: boolean;
  disabled: boolean;
}

/**
 * `<select>` の option 群をまとめて差し替える。
 *
 * DOM 構造との対応が重要な箇所で、既存 option を個別に更新するより
 * 作り直した方が state の取り違えを起こしにくいため、この方式を使っている。
 */
export function replaceSelectOptions(
  select: HTMLSelectElement,
  options: SelectOption[],
): void {
  select.innerHTML = "";
  options.forEach((optionData) => {
    const option = document.createElement("option");
    option.value = optionData.value;
    option.textContent = optionData.label;
    select.append(option);
  });
}

/** 結晶タブ 1 個分の DOM 要素を返す。 */
export function createCrystalTabElement(
  options: CrystalTabMarkupOptions,
): HTMLDivElement {
  const shell = document.createElement("div");
  shell.className = `crystal-tab-shell${options.isActive ? " is-active" : ""}`;
  shell.setAttribute("role", "presentation");
  shell.style.setProperty("--crystal-tab-background", options.tabBackground);
  shell.style.setProperty(
    "--crystal-tab-hover-background",
    options.tabHoverBackground,
  );
  shell.style.setProperty(
    "--crystal-tab-active-background",
    options.tabActiveBackground,
  );
  shell.style.setProperty("--crystal-tab-border", options.tabBorder);

  const tabButton = document.createElement("button");
  tabButton.className = `crystal-tab${options.isActive ? " is-active" : ""}`;
  tabButton.type = "button";
  tabButton.dataset.crystalIndex = String(options.index);
  tabButton.setAttribute("role", "tab");
  tabButton.setAttribute("aria-selected", options.isActive ? "true" : "false");
  tabButton.textContent = options.label;

  const menuButton = document.createElement("button");
  menuButton.className = "crystal-tab-menu-trigger";
  menuButton.type = "button";
  menuButton.dataset.crystalMenuIndex = String(options.index);
  menuButton.setAttribute("aria-label", options.menuAriaLabel);
  menuButton.setAttribute("aria-haspopup", "menu");
  menuButton.setAttribute("aria-expanded", "false");

  shell.append(tabButton, menuButton);
  return shell;
}

/** 結晶表示 ON/OFF チップ 1 個分の DOM を返す。 */
export function createCrystalVisibilityToggleElement(
  options: CrystalVisibilityToggleOptions,
): HTMLLabelElement {
  const label = document.createElement("label");
  label.className = "toggle-chip";

  const input = document.createElement("input");
  input.className = "crystal-visibility-input";
  input.dataset.crystalIndex = String(options.index);
  input.type = "checkbox";
  input.checked = options.checked;
  input.disabled = options.disabled;

  const span = document.createElement("span");
  span.textContent = options.label;

  label.append(input, span);
  return label;
}

/**
 * 「結晶 n」タブ 1 個分の HTML を返す。
 *
 * 既存の tab click handler とメニュー開閉 handler が `data-*` と class 名に依存するため、
 * そこは refactor 後も一切変えない。
 */
export function buildCrystalTabMarkup(
  options: CrystalTabMarkupOptions,
): string {
  return `
      <div
        class="crystal-tab-shell ${options.isActive ? "is-active" : ""}"
        role="presentation"
        style="--crystal-tab-background:${options.tabBackground}; --crystal-tab-hover-background:${options.tabHoverBackground}; --crystal-tab-active-background:${options.tabActiveBackground}; --crystal-tab-border:${options.tabBorder};"
      >
        <button class="crystal-tab ${options.isActive ? "is-active" : ""}" type="button" data-crystal-index="${options.index}" role="tab" aria-selected="${options.isActive ? "true" : "false"}">${options.label}</button>
        <button class="crystal-tab-menu-trigger" type="button" data-crystal-menu-index="${options.index}" aria-label="${options.menuAriaLabel}" aria-haspopup="menu" aria-expanded="false"></button>
      </div>
    `;
}

/** 結晶表示 ON/OFF 行で使うチップ 1 個分の HTML を返す。 */
export function buildCrystalVisibilityToggleMarkup(
  options: CrystalVisibilityToggleOptions,
): string {
  return `
        <label class="toggle-chip">
          <input class="crystal-visibility-input" data-crystal-index="${options.index}" type="checkbox" ${options.checked ? "checked" : ""} ${options.disabled ? "disabled" : ""} />
          <span>${options.label}</span>
        </label>
      `;
}
