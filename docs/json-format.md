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

`placement` には、双晶タイプ、双晶則、追加の配置情報が入ります。貫入双晶の軸方向オフセットは `placement.offsets[]` に保存します。

```json
{
  "from": "base",
  "placement": {
    "type": "penetration",
    "rule": {
      "kind": "axis",
      "axis": { "h": 1, "k": 1, "l": 1 },
      "rotationAngleDeg": 60
    },
    "offsets": [
      {
        "kind": "axis",
        "basis": "twin-axis",
        "amount": 0.5,
        "unit": "axis-plane-intercept"
      }
    ]
  }
}
```

`amount` は双晶軸方向の移動量です。`1` は、双晶軸と同じ指数で距離 `1` の面がその軸と交わる位置までの軸上距離を基準にします。`0` のオフセットは保存時に省略されます。

## Face Fields

各 face は次のような情報を持てます。

- `id`
- `h`, `k`, `l`
- `i` (四指数系のみ)
- `distance`
- `enabled`
- `accentColor`
- `text`

`text` には face engraving/embossing の設定が入ります。

`distance` は面位置を表す値です。たとえば軸比 `a / b / c` の結晶で `(1, 1, 1)` 面の `distance` が `1` の場合、その面は a 軸上の距離 `a`、b 軸上の距離 `b`、c 軸上の距離 `c` の点を通ります。`distance` が `2` なら、それぞれ `2a / 2b / 2c` の点を通ります。`0` や負の値も読み込み・保存できますが、最終的に半空間の共通部分が閉じた 3D solid にならない場合は形状作成エラーになります。

旧 JSON との互換のため、読み込みでは `coefficient` も受け付けます。`distance` と `coefficient` が両方ある場合は `distance` を優先します。旧 `coefficient: 0` は `distance: 100` かつ `enabled: false` として扱います。

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

`src/data/presets/` 配下の built-in preset data は CC BY 4.0 で提供します。
流用・改変時は、各 preset の `metadata.fullReference` または
[`reference.md`](../reference.md) にある出典表記を引き継いでください。
Sekiei / Wfrm-Qz への帰属表示は任意です。
