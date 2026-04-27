# Sekiei

Shape Editor for Kessho Illustration, Export, and Inscription

Sekiei は、結晶学パラメーターから結晶の 3D モデルを生成し、ブラウザ上で確認しながら保存・出力できるフロントエンドアプリです。

単結晶だけでなく、接触双晶・貫入双晶を含む複数結晶の構成も扱えます。プレビュー、JSON 保存/読込、STL / SVG / PNG / JPEG 出力、面ごとの文字加工、プリセット管理を 1 つの UI で提供します。

公開版: https://sekiei.pages.dev/

## 主な機能

- 結晶パラメーター入力
  - 結晶系
  - 軸比
  - 軸間角
  - 面指数
  - 面係数
  - モデルサイズ
- 単結晶と双晶のモデリング
  - 接触双晶
  - 貫入双晶
  - 双晶面指定
  - 双晶軸指定
- 3D プレビュー
  - 回転、拡大縮小、移動
  - 稜線、交線、軸線、ラベルの表示切り替え
  - 表示モード切り替え
  - 面指数ラベル、軸ラベル、双晶補助表示
- 面ごとの文字加工
  - content
  - font
  - size
  - depth
  - offset
  - rotation
- 出力
  - STL
  - SVG
  - PNG
  - JPEG
  - JSON
- プリセット
  - built-in preset
  - 公開 sample JSON
  - wrapper schema ベースの保存/読込

## すぐに試す

公開版は https://sekiei.pages.dev/ から利用できます。

依存をインストールして開発サーバーを起動します。

```powershell
cd sekiei
npm install
npm run dev
```

起動後、表示されたローカル URL をブラウザで開きます。既定では `http://127.0.0.1:5173/` です。

本番ビルドの確認:

```powershell
npm run build
npm run preview
```

## ドキュメント

公開向けの補助ドキュメントは [docs/README.md](./docs/README.md) から辿れます。

- [User Manual](./docs/user-manual.md) / [English](./docs/user-manual.en.md)
  - スクリーンショット付きの基本操作
- [Preview Controls](./docs/preview-controls.md)
  - プレビュー周辺の使い方
- [Changelog](./docs/changelog.md)
  - アプリ内お知らせと共有している更新履歴
- [Known Issues](./docs/known-issues.md)
  - アプリ内お知らせと共有している既知の問題
- [Preset References](./reference.md)
  - built-in preset データの出典一覧
- [Modeling Features](./docs/modeling-features.md)
  - 何が作れるか
- [JSON Format](./docs/json-format.md)
  - 保存・読込 JSON の構造
- [Architecture](./docs/architecture.md)
  - ソース構成
- [Testing](./docs/testing.md)
  - テスト方針と実行コマンド
- [Deployment](./docs/deployment.md)
  - Cloudflare Pages 向けの build 設定

## 更新履歴

詳細は [docs/changelog.md](./docs/changelog.md) を参照してください。

> `2026-04-28 / v0.1.4`
>
> - 英語 UI では英語版マニュアルと英語スクリーンショットを表示するようにしました。

## 既知の問題

詳細は [docs/known-issues.md](./docs/known-issues.md) を参照してください。

> 現在、公開中の既知の問題はありません。

公開 sample:

- [cube.json](./docs/samples/cube.json)
- [cube-text.json](./docs/samples/cube-text.json)
- [hexagonal-prism-phase3.json](./docs/samples/hexagonal-prism-phase3.json)
- [twin-parameters.json](./docs/samples/twin-parameters.json)

## リポジトリ構成

- [index.html](./index.html)
  - ページ入口
- [styles.css](./styles.css)
  - 共通スタイル
- [app-ui.css](./app-ui.css)
  - ページ固有の追加スタイル
- [src/content](./src/content)
  - docs 由来の announcement content loader
- [src/data](./src/data)
  - preset とその loader
- [src/domain](./src/domain)
  - parameter 正規化、双晶 builder、frame
- [src/export](./src/export)
  - preview 連動 export
- [src/geometry](./src/geometry)
  - 結晶形状生成
- [src/io](./src/io)
  - 読込・保存・format
- [src/preview](./src/preview)
  - preview scene、label、xray、style settings
- [src/state](./src/state)
  - UI state helper
- [src/text](./src/text)
  - 面文字加工
- [src/ui](./src/ui)
  - page UI、preset combobox、面一覧、handler
- [tests](./tests)
  - unit / integration / e2e / fixtures

## テスト

日常的な確認:

```powershell
npm run lint:changed
```

仕上げ確認:

```powershell
npm run public:check
```

E2E:

```powershell
npm run test:e2e
```

## ライセンス

アプリケーション本体とプロジェクト文書は [MIT License](./LICENSE) で提供します。

`src/data/presets/` 配下のプリセットデータは
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) で提供します。
流用・改変する場合は、各プリセットの `metadata.fullReference` または
[Preset References](./reference.md) にある出典表記を引き継いでください。
Sekiei / Wfrm-Qz への帰属表示は任意です。

詳しいライセンス境界は [Licensing](./docs/licensing.md) にあります。
第三者依存と bundled font のライセンス整理は [LICENSES.md](./LICENSES.md) にあります。

## 補足

- このリポジトリはブラウザ完結の利用を基本としています。
- 公開向け docs は `docs/` に置いています。
- 利用方法や補助資料は、このリポジトリ内の README と `docs/` にまとめています。
