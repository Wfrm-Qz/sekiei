# Mobile Layout Plan

Sekiei の現行 UI は desktop / tablet 向けの 2 カラム構成を基準にしているため、スマホでは「崩れない」状態までは調整できても、操作の流れ自体はまだ重い。

このメモは、スマホ向けレイアウトをどう切り替えるか、その試作範囲を public repo 側で共有するためのもの。

## Current Issues

- プレビューより先に入力カードが長く続きやすい
- 軸比、軸間角、指数入力などの小さい field が narrow width に弱い
- 面一覧 table はスマホで横幅も縦幅も厳しい
- preview 表示トグルと詳細設定が散っていて、操作の入口が多い
- 出力操作は desktop ヘッダー前提で、スマホ時に flow が見えにくい

## Direction

スマホでは「左カラム / 右カラム」を維持するのではなく、次の構成へ切り替える。

1. 上部に preview を置く
2. preview の下に編集カテゴリ切替タブを置く
3. 既存の section card をカテゴリごとに切り替えて見せる
4. 一度に見せる情報量を減らす

## Phase 1 Prototype

Phase 1 は DOM 全体の大規模組み替えまでは行わず、既存 section を活かしたモバイル専用タブ切替を試す。

### Tabs

- `基本`
  - preset search
  - preset metadata
  - 結晶パラメーター
- `面`
  - 面一覧 table
  - 現在 face card 内にある preview 詳細設定
- `双晶`
  - 双晶パラメーター
- `表示`
  - preview mode
  - visibility toggle 群
- `出力`
  - validation message

### Preview Area

- preview はスマホでも常時上部に表示する
- preview 直下にカテゴリタブを置く
- 視点リセットや慣性 toggle のような「今すぐ触る操作」は preview overlay 側に残す

## Known Gaps In Phase 1

- `面` タブはまだ table ベースで、最終形ではない
- `表示` タブに preview 詳細設定を完全移動していない
- `出力` タブは validation 中心で、保存 / export flow は引き続きヘッダー主導
- ヘッダー自体の compact 化はまだ着手前

## Later Phases

### Phase 2

- 面一覧を table から card / accordion へ移行
- face text を含む面編集を card 単位で完結できるようにする

#### Phase 2 Prototype Status

- スマホ時は `面` タブで table 本体を隠し、同じ編集 state を使う mobile card list を表示する
- 既存の face edit handler は table / mobile card の両方から同じ `data-*` 契約で呼び出す
- 結晶切替タブもスマホ時は横スクロールのタブ帯へ寄せる
- `プレビュー詳細設定` はスマホ時に `表示` タブで見えるように切り替える

### Phase 3

- スマホ向け export flow を下部 action 群か dedicated tab に整理
- preview 詳細設定の構成を `表示` タブ前提に再設計
- ヘッダー操作を overflow menu 中心へ整理

#### Phase 3 Prototype Status

- `出力` タブ内に mobile 専用の保存 / 出力 action 群を追加し、JSON / STL / SVG / PNG / JPEG を直接呼べるようにする
- `出力` タブ内に JSON 読み込み action 群も追加し、`全て / 結晶データ / プレビュー設定` をヘッダーに戻らず選べるようにする
- スマホ幅ではヘッダーの `保存 / 名前を付けて保存 / JSONを読み込む` を隠し、代わりに `メニュー` へ `お知らせ` と JSON 読み込み導線を寄せる
- `表示` タブは `表示モード / 表示項目 / 表示対象の結晶 / 詳細設定` の区切りを明示し、`プレビュー詳細設定` 側はスマホ時だけ外枠を薄めて段の流れを優先する
- `表示` タブの preview 詳細設定は既存 DOM を切り替えて見せる段階にとどめ、内容の再編はまだ未着手
- `表示` タブの preview 詳細設定は、`ラベル` / `線と軸` の大区分は維持しつつ、その中を `面指数と双晶` `軸ラベル` `プリセット表示` `稜線と交線` `軸線` へ分けて、スマホで読み順を追いやすくする
- `出力` タブは、`プロジェクトデータ` `3Dモデル` `プレビュー画像` の 3 区分へ整理し、JSON 保存/読込と画像・モデル出力を同列に混ぜない
- スマホ幅ではヘッダー上の言語 select も隠し、`メニュー` 内へ `お知らせ` `カテゴリ移動` `言語切替` をまとめて、上部の密度を下げる
- preview 画面では、スマホ時に操作ヒントを canvas 外へ逃がし、視点操作群は canvas 下端に寄せた半透明ドックでまとめて、描画領域の主役感を優先する
- preview 下端ドックの quick controls はスマホ時に小型化し、横 1 段のコンパクトな操作帯として扱う
- 操作ヒントは desktop と mobile で文言を分け、mobile では `1本指 / 2本指` ベースの説明へ寄せる

## Implementation Note

試作では `max-width: 760px` を mobile 切替の基準にし、desktop / tablet の DOM と state 管理はそのまま維持する。  
本格移行の前に、スマホでの操作順序と各タブの情報量が妥当かを確認する。

## Current Prototype State

現時点の試作は、次の状態まで入っている。

- preview を先頭に置き、その下を `基本 / 面 / 双晶 / 表示 / 出力` タブで切り替える
- `面` タブは table ではなく mobile card list を出す
- `表示` タブは `表示モード / 表示項目 / 表示対象の結晶 / 詳細設定` に分ける
- `表示対象の結晶` はスマホ時も 2 列で並べる
- `出力` タブは `プロジェクトデータ / 3Dモデル / プレビュー画像` に分ける
- ヘッダー上部は GitHub / X と `メニュー` を中心にし、`お知らせ`、カテゴリ移動、言語切替を `メニュー` に寄せる
- preview の quick controls は、スマホ時に canvas 下端の 1 行ドックへ小型化する
- 操作ヒントは mobile では canvas 外へ逃がし、文言も `1本指 / 2本指` ベースへ切り替える
- touch gesture は `1本指で回転 / 2本指で拡大縮小` を前提にし、2本指後に回転中心がずれにくいよう補正する
- 面指数以外の preview 文字は、desktop の既定値を維持しつつ、スマホ幅では描画時に小さめへ補正して重なりにくくしている

## Open Questions

- 2本指移動は、回転中心ずれとの兼ね合いで現時点では保留
- preview 下部ドックは、まだ操作優先度の整理余地がある
- `表示` タブの詳細設定は読みやすくなったが、完全な最終形ではない
