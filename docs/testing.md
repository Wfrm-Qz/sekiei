# Testing

この文書は、公開レポジトリ向けに Sekiei のテスト実行方法と考え方を簡潔にまとめたものです。

## Test Layers

Sekiei では、主に次の 3 層でテストします。

- unit test
  - 純粋関数や helper の回帰確認
- integration test
  - 複数 module や軽い DOM 連携の確認
- E2E test
  - ブラウザ上の主要操作フロー確認

## Common Commands

通常の確認:

```powershell
npm run lint:changed
```

仕上げ時の確認:

```powershell
npm run public:check
```

テスト実行:

```powershell
npm run test:unit
npm run test:watch
npm run test:coverage
npm run test:e2e
```

## Current Focus Areas

主に次の観点を自動テストで見ています。

- 等価面 grouping と色決定
- JSON / preset の正規化互換
- 接触双晶の基準方向候補
- builder の主要 build 経路
- preset combobox の popup / ARIA
- preview line / xray / export helper
- `index.html` の `data-i18n*` fallback 整合
- 主要な browser flow の E2E

## Useful E2E Scenarios

現行 E2E では、たとえば次のような流れを確認しています。

- preset 読込の基本フロー
- xray 系表示からの SVG export
- preview の慣性とラベル再表示

## What Is Not Fully Covered Yet

まだ自動化が薄い領域もあります。

- Three.js の見た目そのもののピクセル比較
- SVG / PNG / JPEG 出力の詳細比較
- 複雑な preview 操作の総当たり
- 面一覧の細かな UI 操作すべて

## Testing Guidance for Contributors

- 小さな helper を増やしたら unit test を優先します
- `index.html` の固定文言や `i18n` に触れたら、fallback 整合テストを壊していないか確認します
- UI の見た目調整だけでも、少なくとも `npm run build` は通してください
- 公開前の最終確認は `npm run public:check` を優先します
- preview / export / builder まわりの変更では、可能なら `npm run test:unit` まで確認するのが安全です
