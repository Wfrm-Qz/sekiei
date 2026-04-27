# Documentation

このディレクトリには、公開レポジトリ向けに整理した Sekiei の補助ドキュメントを置きます。

公開版: https://sekiei.pages.dev/

## Documents

- [Modeling Features](./modeling-features.md)
  - 何が作れるか、どの表示・出力機能があるか
- [Changelog](./changelog.md)
  - アプリ内お知らせと共有している更新履歴
- [Known Issues](./known-issues.md)
  - アプリ内お知らせと共有している既知の問題
- [Preset References](../reference.md)
  - built-in preset データの出典一覧
- [Project License](../LICENSE)
  - このプロジェクト自体のライセンス（MIT）
- [Licensing](./licensing.md)
  - アプリ本体とプリセットデータのライセンス境界
- [Architecture](./architecture.md)
  - 現在のソース構成と責務分担
- [JSON Format](./json-format.md)
  - 保存・読込 JSON と preset JSON の考え方
- [Testing](./testing.md)
  - テストの層、よく使うコマンド、現状のカバー範囲
- [Deployment](./deployment.md)
  - Cloudflare Pages 向けの build 設定
- [Repository Policy](./repository-policy.md)
  - branch 運用、local hook、GitHub 側で設定したい保護ルール
- [User Manual](./user-manual.md)
  - 利用者向けの基本操作ガイド
- [Preview Controls](./preview-controls.md)
  - プレビュー周辺の操作説明
- [Mobile Layout Plan](./mobile-layout-plan.md)
  - スマホ向けレイアウト再設計の方針と Phase 1 試作範囲

## Samples

- [cube.json](./samples/cube.json)
  - 最小構成の単結晶 sample
- [cube-text.json](./samples/cube-text.json)
  - 面文字加工を含む sample
- [hexagonal-prism-phase3.json](./samples/hexagonal-prism-phase3.json)
  - 表示モードや warning 確認向け sample
- [twin-parameters.json](./samples/twin-parameters.json)
  - 複数結晶を含む twin sample

## Consolidation

- 旧 `docs/TEST-RUNNING.md` は廃止し、テスト実行方法とテスト方針は [Testing](./testing.md) に一本化しました。

## Notes

- 公開レポジトリでは、この `docs/` 配下を利用者向け・開発者向けの説明の中心とします。
- 利用方法、仕様の要点、公開 sample は、この `docs/` 配下から参照できるように整理しています。
