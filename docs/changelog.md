# Changelog

Sekiei のお知らせモーダルで表示する更新履歴です。  
This file is also used as the source for the in-app announcement modal.

## 2026-04-26 / v0.1.3

### ja
- スマホ向けに、プレビューを先頭に置いたタブ式レイアウトの試作を追加しました。
- スマホでは面一覧をカード表示へ切り替え、`基本 / 面 / 双晶 / 表示 / 出力` を行き来できるようにしました。
- スマホの `出力` タブを `プロジェクトデータ / 3Dモデル / プレビュー画像` に整理しました。
- スマホのプレビュー操作を見直し、`1本指で回転 / 2本指で拡大縮小` を前提に回転中心がずれにくいよう調整しました。
- 面指数以外のプレビュー内文字サイズ既定値を下げ、スマホで重なりにくいようにしました。

### en
- Added a mobile-first tabbed layout prototype that keeps the preview at the top.
- On mobile, the face list now switches to cards and can be edited through the `Basics / Faces / Twin / Display / Output` tabs.
- Reorganized the mobile `Output` tab into `Project Data / 3D Model / Preview Images`.
- Adjusted mobile preview interactions around `one-finger rotate / two-finger zoom` so the rotation center is less likely to drift.
- Reduced the default size of preview text except for face indices so labels overlap less on mobile.

## 2026-04-26 / v0.1.2

### ja
- 起動時にお知らせモーダルを表示するようにしました。
- ヘッダーからお知らせをいつでも開けるようにしました。

### en
- Added a startup announcement modal.
- Added a header action so the announcement can be reopened anytime.

## 2026-04-26 / v0.1.1

### ja
- お知らせの既読状態をブラウザに保存するようにしました。

### en
- Started saving announcement read state in the browser.

## 2026-04-25 / v0.1.0

### ja
- Sekiei の公開向け構成を整理しました。

### en
- Prepared the public-facing structure for Sekiei.
