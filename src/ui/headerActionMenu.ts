/**
 * ヘッダー右上の保存メニュー群で使う、ボタンとメニューの対応関係を定義する。
 *
 * 保存形式ごとの処理本体とは切り離し、開閉だけを安全に共通化するための型。
 */
export interface HeaderActionMenuBinding {
  button: HTMLButtonElement | null | undefined;
  menu: HTMLElement | null | undefined;
}

/**
 * 登録済みのヘッダーメニューをすべて閉じ、`aria-expanded` も合わせて戻す。
 *
 * 副作用:
 * - menu.hidden を変更する
 * - button の `aria-expanded` を変更する
 */
export function closeHeaderActionMenus(
  bindings: HeaderActionMenuBinding[],
): void {
  bindings.forEach(({ button, menu }) => {
    if (menu) {
      menu.hidden = true;
    }
    button?.setAttribute("aria-expanded", "false");
  });
}

/**
 * 対象メニューだけを開閉し、それ以外のヘッダーメニューは閉じた状態に保つ。
 *
 * 複数メニューが同時に開くとキーボード操作と click 外閉じの挙動が読みづらくなるため、
 * 常に単一 open に固定している。
 */
export function toggleHeaderActionMenu(
  target: HeaderActionMenuBinding,
  bindings: HeaderActionMenuBinding[],
): void {
  if (!target.button || !target.menu) {
    return;
  }

  const shouldOpen = target.menu.hidden;
  closeHeaderActionMenus(bindings);
  target.menu.hidden = !shouldOpen;
  target.button.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

/** click 元がヘッダーメニュー項目なら、その要素を返す。 */
export function findHeaderActionMenuItem(
  target: EventTarget | null,
): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }
  return target.closest(".header-action-menu-item");
}
