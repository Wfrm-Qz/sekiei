# Modeling Features

Sekiei は、結晶学パラメーターからポリヘドラルな結晶モデルを生成し、ブラウザ上で確認・保存できるフロントエンドアプリケーションです。

## What You Can Model

- 単結晶
- 接触双晶
- 貫入双晶
- 3 個以上の結晶からなる構成

## Input Model

基本となる入力は次のとおりです。

- 結晶系
- 軸比 `a / b / c`
- 軸間角 `alpha / beta / gamma`
- モデルサイズ
- 面一覧
  - ミラー指数
  - 面係数
  - 面ごとの色
  - 面ごとの文字加工設定
- 結晶ごとの色
- 双晶設定
  - 生成元結晶
  - 双晶タイプ
  - 双晶面または双晶軸
  - 回転角
  - 接触面参照

六方晶系・三方晶系では Miller-Bravais 表記 `(h, k, i, l)` を扱います。

## Preview Features

- 3D プレビュー
- 回転、平行移動、ズーム、視点リセット
- 面表示モード切替
  - grouped
  - solid
  - white
  - xray 系
  - custom
- 面指数ラベル表示
- 稜線、交線の表示
- 軸線、軸ラベルの表示
- 双晶軸 / 双晶面ガイド表示
- 結晶ごとの表示切替
- プレビュー詳細設定
  - 線幅、色、透明度
  - ラベル色やフォント
  - custom face/line profile

## Text Engraving / Embossing

各面ごとに文字加工を設定できます。

- content
- font
- font size
- depth
- offsetU / offsetV
- rotation

深さは正値で彫り込み、負値で浮き出しです。

## File Output

現在のアプリでは次の出力に対応しています。

- STL
- SVG
- PNG
- JPEG
- JSON

補助的な出力機能として、結晶パラメーターカード内の `STL分割（β版）` を使い、表示中の全結晶を 1 つの立体へまとめた後に指定平面で 2 分割した STL を保存できます。

## Presets

- built-in preset は `src/data/presets/*.json` に 1 ファイル 1 preset で配置します
- built-in preset のファイル名は `{mineral-slug}-{5桁連番}.json` または `{mineral-slug}-{5桁連番}-{suffix}.json` にします
- `presetId` は suffix を含めない `{mineral-slug}-{5桁連番}` を使います
- preset JSON は通常の保存 JSON と同じ wrapper schema を使います
- 現在の preset 読込では、`preview` セクションは保持されますが自動適用はしません

## Current Constraints

- プレビューや export はかなり高機能ですが、Three.js ベースのため環境差で見え方が少し変わることがあります
- 文字加工フォントは同梱フォントの対応範囲に依存します
- 非常に複雑な和集合や面構成では、警告や fallback を伴うことがあります
