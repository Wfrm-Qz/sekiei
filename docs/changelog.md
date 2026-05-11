# Changelog

Sekiei のお知らせモーダルで表示する更新履歴です。  
This file is also used as the source for the in-app announcement modal.

## 2026-05-11 / v0.1.4

### ja

- 柘榴石の形状プリセット 2 件とスピネル式双晶プリセットを追加しました。
- 双晶を編集中に単結晶プリセットを読み込んだ場合、既存の双晶状態を引き継がず単結晶として読み込むようにしました。
- 貫入双晶で、派生結晶を双晶軸方向へずらす `軸方向オフセット` を指定できるようにしました。
- 面位置の入力を `係数` から `距離` に変更し、旧 `coefficient` JSON は読み込み時に互換変換するようにしました。
- 貫入双晶の双晶軸ガイドが、結晶軸の中心を通るように修正しました。
- UIを調整しました。

### en

- Added two garnet shape presets and a spinel-law twin preset.
- When loading a single-crystal preset while editing a twin, the preset now loads as a single crystal instead of inheriting the current twin state.
- Added `Axis Offset` for penetration twins so the derived crystal can be moved along the twin axis.
- Changed face position input from `Coefficient` to `Distance`, while still converting legacy `coefficient` JSON on import.
- Fixed the penetration-twin axis guide so it passes through the center of the crystal axes.
- Adjusted the UI.

## 2026-04-27 / v0.1.3

### ja

- ツール内マニュアルに目次を追加し、目的別ガイドや各機能の説明へ移動しやすくしました。
- 面一覧の説明を拡充し、h/k/l、係数、表示切り替え、面や結晶の追加をスクリーンショット付きで確認できるようにしました。
- 面一覧の h/k/l 入力欄に常時表示の上下ボタンを追加し、係数と同じように増減できるようにしました。
- 各ボタンや入力欄にホバー説明を追加し、操作できない状態では理由を表示するようにしました。
- 英語 UI では英語版マニュアルと英語スクリーンショットを表示するようにしました。

### en

- Added a table of contents to the in-app manual so task guides and feature explanations are easier to navigate.
- Expanded the face list documentation with screenshots for h/k/l, coefficients, visibility toggles, and adding faces or crystals.
- Added always-visible up/down controls to the face list h/k/l fields so they can be adjusted like the coefficient field.
- Added hover help for buttons and input fields, including reasons when an operation is unavailable.
- Added an English user manual and English screenshots for the English UI.

## 2026-04-27 / v0.1.2

### ja

- STL / SVG 保存時に、デバッグ JSON が自動で追加ダウンロードされないようにしました。

### en

- Stopped automatically downloading debug JSON files when saving STL or SVG files.

## 2026-04-27 / v0.1.1

### ja

- スクリーンショット付きマニュアルを追加し、ツール内からも開けるようにしました。

### en

- Added a screenshot-based user manual and made it available from inside the tool.

## 2026-04-27 / v0.1.0

### ja

- Sekiei を公開しました。

### en

- Released Sekiei publicly.
