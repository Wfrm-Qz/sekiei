# Architecture

この文書は、現行の Sekiei コードベースを公開レポジトリ向けに簡潔に説明するための概要です。

## Entry Points

- `index.html`
  - 単一ページの HTML エントリー
- `styles.css`
  - 全体のベーススタイル
- `app-ui.css`
  - ページ固有のレイアウト調整
- `src/main.ts`
  - アプリ起動、主要 wiring、UI と preview の接着

## Main Source Areas

### `src/domain`

幾何や双晶構成の中核ロジックです。

- `builder.ts`
  - 複数結晶の build、接触/貫入の配置、和集合
- `crystalFrame.ts`
  - 双晶面 / 双晶軸の補助計算
- `parameters/`
  - runtime parameter と schema v2 保存形の変換

### `src/geometry`

単結晶形状の生成ロジックです。

- `crystalGeometry.ts`
  - 半空間交差、面ポリゴン化、validation、警告生成、preview face への文字設定反映

### `src/preview`

3D preview と overlay 表示を扱います。

- `deferredTrackballControls.ts`
  - TrackballControls の遅延読込、proxy target 共有、mobile touch の遷移補正
- `previewScene.ts`
  - scene object の組立、面文字輪郭の overlay 線追加
- `previewRuntime.ts`
  - preview 同期や表示状態の helper
- `previewLabels.ts`
  - label 表示
- `previewProfiles.ts`
  - face/line profile と display mode
- `previewStyleSettings.ts`
  - preview 詳細設定の構造と文字サイズ既定値

### `src/text`

面文字加工まわりです。

- `faceTextGeometry.ts`
  - 面文字のフィット、押し出し三角形化、preview 用輪郭線生成

### `src/export`

preview と同じ見た目に近い形で各種出力を組み立てます。

- `exportActions.ts`
  - UI からの export 起動
- `previewExport.ts`
  - canvas / overlay を使った PNG / JPEG / SVG 出力
- `previewExportSurface*.ts`
  - surface export 用の profile / rendering / geometry helper
- `previewExportLines.ts`
  - line export helper

### `src/ui`

UI の描画と DOM 配線です。

- `formUi.ts`
  - フォーム再描画と preset 適用の orchestration
- `formRender.ts`
  - input/select への値反映 helper
- `page/`
  - page element 参照、翻訳反映、軽量 UI helper、mobile tab layout state
- `preset/`
  - preset combobox、preset metadata、preset 適用 helper
- `faceTable/`
  - 面一覧 table と mobile card list、行内操作
- `handlers/`
  - import / export / お知らせ / mobile header menu などのイベント配線

### `src/content`

公開ドキュメント由来の軽量 content loader です。

- `announcements.ts`
  - `docs/changelog.md` と `docs/known-issues.md` を読み込み、in-app のお知らせ表示用データへ整形

### `src/state`

小さな mutation と state access helper を置きます。

### `src/data`

- `presets/*.json`
  - built-in preset 定義
- `presets.ts`
  - preset 一覧生成、locale 解決、UI 向け整形

## Architectural Notes

- 単結晶と双晶は、別ページではなく単一 UI の中で扱います
- ただし双晶ドメイン自体は明確に存在するため、`twin` という名前はドメイン側に残しています
- 近年の refactor では、巨大ファイルから次の helper を外出ししています
  - `previewRuntime.ts`
  - `pageLifecycle.ts`
  - `presetApplication.ts`
  - `previewExportLines.ts`
  - `previewExportSurfaceProfiles.ts`
  - `previewExportSurfaceRendering.ts`
  - `previewExportSurfaceGeometry.ts`
- mobile layout 試作では desktop / tablet の DOM を保ったまま、`src/ui/page/mobileLayout.ts` と `data-mobile-layout-*` 属性で mobile 時だけ section を切り替えています

## Public Development Guidance

- 挙動変更と refactor はなるべく分ける
- UI は HTML/CSS/TypeScript の結合が強いので、小さく段階的に触る
- `src/i18n.ts` の日本語を変えたら英語も同時に更新する
- `index.html` の `data-i18n*` fallback は `src/i18n.ts` と一致させる
- お知らせの更新履歴と既知の問題は `docs/changelog.md` と `docs/known-issues.md` を正本にし、UI 側へ重複ベタ書きしない
