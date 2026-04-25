/** @type {import("stylelint").Config} */
export default {
  extends: ["stylelint-config-standard"],
  rules: {
    // 既存 UI の色記法や alpha 表記を大規模に書き換えると差分が広がるため、
    // 現時点では記法の統一より挙動維持を優先する。
    "alpha-value-notation": null,
    "color-function-alias-notation": null,
    "color-function-notation": null,
    "color-hex-length": null,
    // 既存 CSS のクラス命名・フォント指定は UI 改修で定着済みなので、
    // ここでは naming/style のみを理由に壊さない。
    "font-family-name-quotes": null,
    "selector-class-pattern": null,
    // 既存レイアウトは長手指定や vendor prefix に依存している箇所があるため、
    // 自動修正を避けて lint 側を緩める。
    "declaration-block-no-redundant-longhand-properties": null,
    "media-feature-range-notation": null,
    "no-descending-specificity": null,
    "property-no-deprecated": null,
    "property-no-vendor-prefix": null,
    "shorthand-property-no-redundant-values": null,
  },
};
