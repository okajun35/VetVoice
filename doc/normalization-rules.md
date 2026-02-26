# 正規化ルール仕様

最終更新: 2026-02-26

## 目的

`assets/normalization_rules.json` は、音声認識や抽出結果の表現ゆれを
運用で調整するためのルール定義ファイルです。

対象コンポーネント:
- `Master_Matcher`（薬剤クエリ正規化）
- `runPipeline`（処置/投与経路の文言正規化、drug canonical上書き）

## ファイルと生成物

- 編集対象: `assets/normalization_rules.json`
- 生成物: `amplify/data/handlers/generated/normalization-rules-data.ts`
- 生成コマンド: `npm run generate-assets`

注意:
- 生成物は直接編集しない。
- ルール変更後は `npm test` と `npm run build` を実行する。

## JSONスキーマ

```json
{
  "drugQueryNormalizationRules": [
    {
      "pattern": "([0-9０-９]+[%％])?ブドウ糖液",
      "replacement": "$1ブドウ糖注射液",
      "flags": "gu"
    }
  ],
  "planTextNormalizationRules": [
    {
      "pattern": "静脈内投与|静脈投与|静注",
      "replacement": "静脈内注射",
      "flags": "gu"
    }
  ],
  "drugCanonicalOverrideRules": [
    {
      "triggerPattern": "ブドウ糖液",
      "canonicalName": "ブドウ糖注射液",
      "masterCode": "DRUG:ブドウ糖注射液",
      "ifCanonicalIn": ["ブドウ糖"],
      "ifMasterCodeIn": ["DRUG:ブドウ糖"]
    }
  ]
}
```

## 各キーの意味

### `drugQueryNormalizationRules`

用途:
- `matchDrug()` に渡す前のクエリ文字列を正規化する。

フィールド:
- `pattern`: JavaScript正規表現パターン文字列
- `replacement`: `String.replace` の置換文字列（例: `$1`）
- `flags`: 正規表現フラグ（通常は `gu`）

### `planTextNormalizationRules`

用途:
- `runPipeline` の `p[].name`（procedureのみ）および `p[].dosage` を正規化する。

典型例:
- `静脈内投与` / `静注` → `静脈内注射`

### `drugCanonicalOverrideRules`

用途:
- drugマッチ後に `canonical_name` / `master_code` を上書きするガードレール。

フィールド:
- `triggerPattern`: 元テキストにこの文字列が含まれると候補
- `canonicalName`: 上書き先 canonical
- `masterCode`: 上書き先 master code
- `ifCanonicalIn`: 現在の canonical がこの配列に含まれる場合のみ適用（任意）
- `ifMasterCodeIn`: 現在の master code がこの配列に含まれる場合のみ適用（任意）

適用条件:
- `ifCanonicalIn` と `ifMasterCodeIn` のいずれかに一致すれば適用（OR）。
- 両方未指定なら `triggerPattern` のみで適用。

## 適用順序

1. `matchDrug` 内で `drugQueryNormalizationRules` 適用
2. fuzzy matching により候補選定
3. `runPipeline` の `normalizePlanItem` で `planTextNormalizationRules` 適用
4. `drugCanonicalOverrideRules` で必要時に canonical/master を補正

## 運用ガイド

1. まずは `dictionary.csv` / Transcribe語彙で改善できるか確認
2. それでも残る表現ゆれだけを `normalization_rules.json` に追加
3. 1ルールずつ追加し、影響範囲をテストで確認

## 追加時の注意

- 過剰に広い `pattern` は避ける（誤置換を誘発しやすい）。
- `drugCanonicalOverrideRules` は最小条件で書く（対象を絞る）。
- `flags` の `g`/`u` を基本に、`i` は必要時のみ使う。

## トラブルシュート

- ルールが効かない: `npm run generate-assets` を実行したか確認
- ビルド失敗: `pattern` が不正な正規表現になっていないか確認
- 想定外の置換: 直近追加したルールを一旦外して再検証
