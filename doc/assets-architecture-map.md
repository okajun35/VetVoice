# Assetsアーキテクチャマップ

最終更新: 2026-02-27

## 目的

`assets/` 配下の各ファイルが、どの生成物・どのハンドラ・どの処理段で使われるかを
一枚で把握できるようにする。

## 全体フロー（assets -> generated -> runtime）

1. `assets/*` を更新
2. `npm run generate-assets` で `amplify/data/handlers/generated/*.ts` を再生成
3. `runPipeline` / 各ハンドラが generated 定数を参照して処理
4. 必要に応じて AWS 側（Transcribe Custom Vocabulary）へ反映

生成スクリプト:
- `scripts/generate-asset-modules.ts`

## Assets責務マップ

| assetsファイル | 生成物 | 主な利用コード | パイプライン段 | 役割 |
|---|---|---|---|---|
| `assets/dictionary.csv` | `generated/dictionary-data.ts` | `handlers/dictionary-expander.ts` | 辞書展開 | 略語展開・言い換え正規化 |
| `assets/abbrev_lexicon.json` | `generated/abbrev-lexicon-data.ts` | （現状は運用参照用） | 運用基盤 | 略語の正本（カテゴリ/揺れ候補） |
| `assets/normalization_rules.json` | `generated/normalization-rules-data.ts` | `handlers/normalization-rules.ts`, `run-pipeline.ts`, `handlers/master-matcher.ts` | 抽出前正規化 / 照合前後正規化 | 誤認識補正、投与経路整形、canonical補正 |
| `assets/prompts/extractor.txt` | `generated/extractor-prompt-data.ts` | `handlers/extractor.ts` | Extractor LLM | 構造化抽出の仕様 |
| `assets/byoumei.csv` | `generated/byoumei-data.ts` | `handlers/master-matcher.ts` | マスタ照合 | 病名候補照合 |
| `assets/shinryo_tensu_master_flat.csv` | `generated/shinryo-tensu-data.ts` | `handlers/master-matcher.ts` | マスタ照合 | 処置候補照合 |
| `assets/reference_compact.csv` | `generated/reference-compact-data.ts` | `handlers/master-matcher.ts` | マスタ照合 | 薬剤候補照合 |
| `assets/shinryo_betsu_snow_regions.csv` | `generated/snow-regions-data.ts` | `handlers/kyosai-generator.ts` | 共済文書生成 | 雪寒補正参照 |
| `assets/transcribe-vocabulary-vetvoice-ja-v1.txt` | なし（AWSへアップロード） | `scripts/transcribe-vocab-update.sh` / AWS Transcribe | 音声認識前段 | Transcribe Custom Vocabulary |
| `assets/eval/gold.v1.jsonl` | なし | `scripts/evaluate-pipeline.ts` | 評価 | 固定評価データ |

## 処理段ごとの参照関係

1. **Transcribe**
- 参照: `assets/transcribe-vocabulary-vetvoice-ja-v1.txt`（AWS側語彙）
- 実行: `handlers/transcriber.ts`

2. **辞書展開**
- 参照: `assets/dictionary.csv`
- 実行: `handlers/dictionary-expander.ts`

3. **抽出前正規化**
- 参照: `assets/normalization_rules.json` の `preExtractionTextNormalizationRules`
- 実行: `run-pipeline.ts` -> `normalizePreExtractionTextByRules`

4. **Extractor**
- 参照: `assets/prompts/extractor.txt`
- 実行: `handlers/extractor.ts`

5. **マスタ照合 / 後段正規化**
- 参照: `assets/byoumei.csv`, `assets/shinryo_tensu_master_flat.csv`, `assets/reference_compact.csv`, `assets/normalization_rules.json`
- 実行: `handlers/master-matcher.ts`, `run-pipeline.ts`

## スキーマ定義はどこにあるか

1. **Amplify Dataスキーマ（GraphQLモデル/クエリ）**
- 定義: `amplify/data/resource.ts`
- 含むもの: `Cow`, `Visit`, `PipelineOutput`, `runPipeline` 引数

2. **ExtractedJSONスキーマ（アプリ内部）**
- 定義: `amplify/data/handlers/parser.ts` の `ExtractedJSON` 型
- 検証: 同ファイル `parse()` で実施

3. **正規化ルールJSONスキーマ（アプリ内部）**
- 定義: `amplify/data/handlers/normalization-rules.ts` の `NormalizationRulesSchema` 型
- 検証: ロード時に不正正規表現をスキップ

4. **略語レキシコンJSON**
- 現状: `assets/abbrev_lexicon.json` は明示的JSON Schema未導入
- 運用: `doc/abbrev-lexicon.md` を仕様として利用

## 関連ドキュメント索引

- `README.md`（全体概要）
- `doc/normalization-rules.md`（正規化ルール詳細）
- `doc/abbrev-lexicon.md`（略語レキシコン運用）
- `doc/save-and-display-flow.md`（保存/表示導線）
- `doc/evaluation-baseline.md`（評価手順）
- `doc/whisper-poc-plan.md`（Whisper比較POC）

