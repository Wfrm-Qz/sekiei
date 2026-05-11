# AGENTS.md

このファイルは Sekiei 公開リポジトリ向けのプロジェクト固有ルールを定義します。

## 適用範囲

- より深い階層に別の `AGENTS.md` がない限り、この内容をリポジトリ全体に適用します。

## 運用ルールの保守

- 作業中に、今後も再利用すべき運用ルールや手順上の注意点が見つかった場合は、同じ作業の中で該当する `AGENTS.md` または local skill に反映します。
- 反映先は、効かせたい範囲に対して最も狭い `AGENTS.md` と、実際に使う該当 skill を優先します。
- 範囲が明確な場合は自動で更新します。広すぎる、曖昧、または別プロジェクトへ影響する場合だけユーザーに確認します。
- 追加する内容は、今後の作業に効く安定したルールに限ります。試行錯誤や一時的なデバッグ履歴は `AGENTS.md` や skill へ入れません。

## 入口と主要ファイル

- 正式版かつ唯一のページ入口は `index.html` です。
- UI の主な編集対象:
  - `index.html`
  - `src/main.ts`
  - `styles.css`
  - `app-ui.css`
- 主な責務分担:
  - `src/preview/`
    - preview scene / label / xray / style settings
  - `src/export/`
    - SVG / PNG / JPEG / STL などの出力補助
  - `src/ui/`
    - page 初期化、preset combobox、面一覧、各 handler
  - `src/domain/`
    - 結晶・双晶の parameter 正規化、builder、frame
  - `src/data/presets/`
    - built-in preset JSON

## 公開リポジトリの境界

- 公開向け補助ドキュメントは `docs/` 配下を正とします。
- 内部の仕様書、開発ログ、試行履歴は、この公開リポジトリには含めません。
- この公開リポジトリに `tasks/` を復活させないでください。
- `.agents/` はローカル運用用として Git 管理対象から外します。
- ユーザーが認識できる挙動、UI、出力内容、既知の制約が変わる場合は、同じ作業で `docs/changelog.md` を更新します。
- お知らせに書く内容のうち、できることが変わっていない UI 調整は、不具合修正でない限り `UIを調整しました。` 程度の簡潔な表現にします。
- `docs/changelog.md` の最新項目を変えた場合は、README の更新履歴抜粋と `tests/unit/data/announcements.test.ts` の最新 version 期待値も追従します。
- リリースと version 変更は一致させます。実際に release version を上げる指示や公開反映がない限り、新しい version section は作らず、未リリースの変更は現在の release 範囲の最新 changelog entry に合流します。
- 未リリース変更を最新 changelog entry に合流するときは、その entry の日付も今回の更新日へ揃え、README の更新履歴抜粋と announcement test も同じ日付・version にします。
- `src/content/announcements.ts` の `updatedAt` はお知らせ再表示用の revision として更新してよいですが、release version の代わりとして扱いません。
- 公開 sample JSON は `docs/samples/` に置きます。
- スクリーンショット付きマニュアルの画像は日本語版を `docs/images/user-manual/`、英語版を `docs/images/user-manual/en/` に置きます。
- UI の配置、主要ラベル、基本操作の流れを変えた時は、`docs/user-manual.md` と `docs/user-manual.en.md` の説明とスクリーンショットを必要に応じて差し替えます。
- ツール内のマニュアル表示は `docs/user-manual.md` / `docs/user-manual.en.md` を `src/content/userManual.ts` からロケール別に読むため、マニュアル画像リンクを変えた時は import map と画像リンク test も追従します。
- integration test fixture は `tests/fixtures/` に置きます。
- Playwright の E2E spec は `tests/e2e/` に置きます。
- `docs/testing.md` が公開向けのテスト説明の正本です。旧 `docs/TEST-RUNNING.md` 前提では扱いません。

## Issue 起点の作業

- Sekiei の修正作業では、原則として実装・ドキュメント編集に入る前に GitHub Issue を作成します。
- Issue 作成後、その Issue 番号に対応する `issue/*` ブランチを作って作業します。
  - 例: `issue/12-fix-announcement-date`
- Pull request は通常 `issue/* -> develop` で作成します。
- `develop -> master` は公開反映用の PR として分けます。
- 既に該当 Issue がある場合は、その Issue を使います。
- ユーザーが明示的に Issue 不要、または直接作業を指示した場合だけ、この手順を省略してよいです。

## ライセンスと同梱資産

- 第三者依存と bundled font の公開向け整理は `LICENSES.md` を正とします。
- `assets/fonts/` の同梱フォントは実際に使われています。不要と決めつけて削除しないでください。
- bundled font のライセンス文面は次に置いています。
  - `assets/fonts/LICENSE-MgOpen.txt`
  - `assets/fonts/LICENSE-Gentilis-OFL-1.1.txt`
  - `assets/fonts/LICENSE-Sora-OFL-1.1.txt`
- フォントや第三者依存の扱いを変える時は、コードだけでなく `LICENSES.md` と必要なライセンステキストも追従します。

## UI 文言と i18n

- `ワイヤーフレーム` ではなく `稜線` を使います。
- preview 制御の短い表記は次を維持します。
  - `ラベル`
  - `回転の慣性`
  - `視点リセット`
- `双晶交線` は `交線` を使います。
- `個晶` 表記は `結晶` に統一します。
- `基準個晶` は `結晶1` を使います。
- `custom` の UI 名は次を使います。
  - 表示モード: `カスタム(β版)`
  - 折り畳み見出し: `高度な設定(β版)`
- 日本語 UI 文言を変えたら、対応する `src/i18n.ts` の英語文言も同時に更新します。
- `index.html` の `data-i18n` / `data-i18n-placeholder` / `data-i18n-aria-label` の fallback 文言は、現在の日本語辞書と一致させます。
- `index.html` fallback と `src/i18n.ts` の整合は `tests/unit/ui/page/indexHtmlI18nFallback.test.ts` で固定されています。
- 英語 UI で左タブ列が窮屈になる箇所は、必要に応じて短縮表記を使ってよいですが、`aria-label` など説明用途はフル表記を維持します。

## Preview / Export

- 双晶 preview の操作感は、双晶専用の理由がない限り単結晶 preview と揃えます。
- 軸視点ボタンの向きは次を守ります。
  - `a`, `b`, `a1`, `a2`, `a3` 視点では `c+` が画面上方向
  - `c` 視点では `a+` または `a1+` が画面下方向
- 四指数系（三方晶系・六方晶系）の初期視点は専用ロジックがあります。実表示確認なしに不用意に変えないでください。
- PNG 出力は見えている preview と一致するラスタ出力を基本にします。
- JPEG 出力は白背景です。
- PNG / SVG は、明示的な要件がない限り透過背景を維持します。
- 書き出しには UI ボタン、トグル、操作説明を含めません。
- SVG の結晶本体ベクター化は不具合履歴が多いので、安易に広げません。特に共有面、接触双晶、白線、色ずれに注意します。

## Preset / JSON / Sample / Fixture

- built-in preset は `src/data/presets/` で、1 ファイル 1 preset を守ります。
- built-in preset file は `{mineral-slug}-{5桁連番}.json` または `{mineral-slug}-{5桁連番}-{suffix}.json` にします。
  - `presetId` は suffix を含めず `{mineral-slug}-{5桁連番}` に固定します。
  - suffix は人間向けの補助情報で、識別子として扱いません。
- preset JSON、公開 sample JSON、test fixture JSON は現行 wrapper schema に揃えます。
  - outer: `schema: "sekiei-twin-preview-document-v1"`
  - inner parameters: `version: 2`, `schema: "sekiei-document"`
- face の位置指定は現行 schema では `distance` を使います。旧 `coefficient` は import 互換専用として扱い、保存 JSON / preset / sample / fixture へ新規に書きません。
- 旧 `coefficient` を読み込むときは、`distance` があれば `distance` を優先します。`coefficient > 0` は `distance = 1 / coefficient`、`coefficient: 0` は `distance: 100` かつ `enabled: false` として扱います。
- 公開 sample は `docs/samples/`、test fixture は `tests/fixtures/domain/` を正とします。
- 結晶色と face 色は preview 側へ複製せず、`parameters.crystals[].accentColor` と `parameters.crystals[].faces[].accentColor` を正として扱います。
- wrapper preset / wrapper export JSON に preview 設定を保持してよいですが、現行の preset 適用では preview 設定を自動適用しません。保持と適用を混同しないでください。
- preset / sample / fixture の schema 整合は `tests/unit/data/jsonSchemaDocuments.test.ts` で固定されています。

## テストと公開前チェック

- unit / integration / E2E の 3 層を維持します。
- 主な配置:
  - `tests/unit/`
  - `tests/integration/`
  - `tests/e2e/`
  - `tests/fixtures/`
- 編集中の確認は `npm run lint:changed` を既定にします。
- `lint:changed` の補助スクリプトは repo 内の `scripts/` に置き、公開リポジトリに `.agents/` 前提の実行経路を残しません。
- 仕上げ確認は `npm run public:check` を基本にします。
- `public:check` は公開向けの禁止パス・機密らしい文字列・生成物の追跡有無を確認したうえで、lint / unit test / build を実行します。
- `.githooks/pre-push` は `npm run public:check` を実行します。push 前に必ず効かせるため、この repo では `git config core.hooksPath .githooks` を設定して使います。

## ブラウザキャッシュ破棄

- ブラウザが直接読む JS / CSS を変更したら、関連する `?v=` を更新します。
- とくに次を触った時は確認します。
  - `index.html`
  - `src/main.ts`
  - `src/ui/`
  - `src/preview/`
  - `src/export/`
  - `styles.css`
  - `app-ui.css`

## コメントと診断

- `html` / `ts` / `css` の主要ファイルには、日本語で責務コメントを残します。
- 型定義、主要関数、壊れやすい分岐、DOM 構造との対応関係には、日本語で理由コメントを残してよいです。
- `t(...)` / `translate(...)` / `data-i18n*` を多く使う箇所では、どの日本語文言群を扱うかが追えるセクション単位・モジュール単位の要約コメントを残してよいです。
- 不具合修正では、原因切り分けに役立つ値を診断ログまたは診断データとして確認できるようにします。

## UI 改修の進め方

- DADS の考え方に可能な範囲で寄せてよいですが、一気に広く触らず段階的に進めます。
- 既存動作は明示指示がない限り維持します。
- 高リスク UI は小さく分けて進めます。
  - preset combobox
  - 結晶タブとそのメニュー
  - preview 詳細設定
  - 面一覧の行内操作
- 面一覧や preview 設定の密度調整で悪化した場合は、内部レイアウト変更を rollback し、外枠だけの改善に留めてよいです。

## PowerShell / Git

- Windows PowerShell では依存コマンドを `&&` や `||` でつながないでください。
- `git add`、`git commit` などは別々に実行します。
- このリポジトリでのコミットメッセージは日本語にします。

## 一時ファイルと未追跡ファイル

- repo 直下の `temp/` は、ユーザーが明示しない限りコミットしません。
- `server.log`、`server-error.log`、`dev.log`、`dev-error.log` はコミットしません。
- ユーザーが触れていない未追跡 sample / preset / task file は勝手にコミットしません。
