# 評価基盤（固定セット + F1 + confirmed誤り率）

## 目的

精度改善の前後差分を、同一データセットで再現可能に比較する。

## 使い方

```bash
npm run eval
```

任意のデータセットを指定:

```bash
npm run eval -- assets/eval/gold.v1.jsonl tmp/eval
```

## 入力データ

`jsonl` 形式。1行1ケース。

必須フィールド:

- `id`
- `input_extracted_json`
- `gold_entities` (`type`: `disease|procedure|drug`, `name`)

サンプルは `assets/eval/gold.v1.jsonl`。

最小例:

```json
{
  "id": "case-001",
  "note": "肺炎疑い + 薬剤別名",
  "input_extracted_json": {
    "vital": { "temp_c": 39.8 },
    "s": "食欲不振",
    "o": "発熱",
    "a": [{ "name": "肺炎疑い" }],
    "p": [{ "name": "アモキシシリンLA注", "type": "drug", "dosage": "10ml" }]
  },
  "gold_entities": [
    { "type": "disease", "name": "肺炎" },
    { "type": "drug", "name": "アモキシシリン油性懸濁注射液" }
  ]
}
```

## 出力

- `tmp/eval/latest.json`
- `tmp/eval/latest.md`

## 指標

- エンティティ Precision / Recall / F1
  - `overall`
  - `disease` / `procedure` / `drug` 別
- confirmed誤り率
  - `confirmed_errors / confirmed_total`
  - `status=confirmed` のみ対象

## 運用ルール（推奨）

- 固定セットはバージョン管理する（例: `gold.v1.jsonl`, `gold.v2.jsonl`）。
- 一度評価に使い始めたファイルは、同一バージョン内で行順・内容を変えない。
- 変更が必要な場合は新バージョンを作る（上書きしない）。
- 精度改善PRでは `npm run eval` の結果（`latest.md`）を添付して比較する。

## 比較の仕方

1. 変更前ブランチで `npm run eval` を実行し、`latest.json` を保存
2. 変更後ブランチで `npm run eval` を実行
3. 次を比較する
   - `entity_metrics.overall.f1`
   - `entity_metrics.by_type.*.f1`
   - `confirmed.confirmed_error_rate`

確認ポイント:

- F1が改善しても `confirmed_error_rate` が悪化していないか
- `drug` の誤confirmedが増えていないか
