# JSON Format

Sekiei では、保存・読込・preset で共通の JSON 形式を使います。

## Two-Layer Structure

アプリが扱う JSON は、現在次の 2 層で考えると分かりやすいです。

### 1. Wrapper document

```json
{
  "schema": "sekiei-twin-preview-document-v1",
  "parameters": { "...": "..." },
  "preview": {
    "faceDisplayMode": "grouped",
    "previewStyleSettings": { "...": "..." }
  }
}
```

この wrapper は、結晶データと preview 設定を同梱するための外側の document です。

### 2. Parameters document

`parameters` の中身は、保存用 schema v2 の結晶データです。

```json
{
  "version": 2,
  "schema": "sekiei-document",
  "crystalSystem": "trigonal",
  "axes": { "a": 1, "b": 1, "c": 2.733 },
  "angles": { "alpha": 90, "beta": 90, "gamma": 120 },
  "sizeMm": 50,
  "crystals": [
    {
      "id": "base",
      "enabled": true,
      "faces": []
    }
  ]
}
```

## Main Fields

### Shared fields

- `version`
- `schema`
- `presetId`
- `name`
- `metadata`
- `crystalSystem`
- `axes`
- `angles`
- `sizeMm`

### Crystal list

複数結晶構成は `crystals[]` で表します。

各 crystal は少なくとも次を持てます。

- `id`
- `enabled`
- `accentColor`
- `faces`

派生結晶ではさらに次を持ちます。

- `from`
- `placement`
- `contact`

## Face Fields

各 face は次のような情報を持てます。

- `id`
- `h`, `k`, `l`
- `i` (四指数系のみ)
- `coefficient`
- `enabled`
- `accentColor`
- `text`

`text` には face engraving/embossing の設定が入ります。

## Color Ownership

色設定は preview 側ではなく `parameters` 側で保存します。

- 結晶色
  - `parameters.crystals[].accentColor`
- 面色
  - `parameters.crystals[].faces[].accentColor`

## Preview Fields

wrapper の `preview` には次が入ります。

- `faceDisplayMode`
- `previewStyleSettings`

ただし現在の built-in preset 読込では、preset に `preview` が含まれていても自動適用はしません。ユーザーの現在の preview 設定を勝手に上書きしないためです。

## Runtime-Only Settings

次のような作業用設定は、結晶データ JSON に保存しません。

- STL 分割の有効 / 無効
- STL 分割に使う面指数

これらは結晶そのものの定義ではなく、現在の作業セッションにおける出力設定として扱います。そのため、プリセット適用や `結晶データ` 読込では上書きしません。

## Compatibility

- 読み込みでは旧形式との互換をある程度維持します
- 保存は現行 schema に正規化します
- built-in preset JSON も同じ wrapper schema を使います
- built-in preset の安定 ID は `{mineral-slug}-{5桁連番}` です
- built-in preset のファイル名 suffix は検索性・可読性のための補助情報であり、`presetId` には含めません

## Practical Tip

公開リポジトリに preset を追加したい場合は、まずアプリから JSON 保存したものをベースにするのが一番安全です。その JSON を `src/data/presets/` に置き、必要な metadata を整える流れを推奨します。
