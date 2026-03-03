# VetVoice - 獣医音声診療記録システム

大動物（牛）を診療する日本の獣医師向け、音声入力診療記録 PoC システムです。

## 技術スタック

- インフラ: AWS Amplify Gen 2 (TypeScript-based CDK)
- リージョン: `us-east-1` (N. Virginia)
- フロントエンド: React 18 + TypeScript + Vite
- バックエンド: AppSync (GraphQL) + Lambda + DynamoDB
- 認証: Amplify Auth (Cognito)
- ストレージ: Amplify Storage (S3)
- AI: Amazon Bedrock (Nova / Claude), Amazon Transcribe

## AIパイプライン概要

`runPipeline` は以下の順で処理されます。

1. Transcribe（`PRODUCTION` / `AUDIO_FILE` のみ）
2. 辞書展開（略語展開、専門語補正）
3. Extractor LLM で構造化JSON抽出（`ExtractedJSON`）
4. マスタ照合（病名・処置コード候補付与）
5. テンプレート選択
6. SOAP Generator LLM で SOAP テキスト生成
7. Kyosai Generator LLM で 家畜共済ドラフト生成
8. Visit レコード保存（DynamoDB）

## ドキュメント索引

- `doc/assets-architecture-map.md`（assetsとランタイムの全体マップ）
- `doc/normalization-rules.md`（正規化ルール仕様）
- `doc/abbrev-lexicon.md`（略語レキシコン運用）
- `doc/save-and-display-flow.md`（保存から表示までの導線）
- `doc/evaluation-baseline.md`（評価手順）
- `doc/whisper-poc-plan.md`（Whisper比較POC）

## 3つのLLMコンポーネント（明示）

本システムはパイプライン内で **3つのLLM** を使います（`runPipeline` 内）。

| コンポーネント | 役割 | デフォルトモデル | 直接上書き（開発UI/API） | Lambda環境変数上書き |
|---|---|---|---|---|
| Extractor | 音声/テキストから構造化JSONを抽出 | `anthropic.claude-haiku-4-5-20251001-v1:0` | `extractorModelId` | `EXTRACTOR_MODEL_ID` |
| SOAP Generator | 構造化JSONからSOAP文を生成 | `amazon.nova-lite-v1:0` | `soapModelId` | `SOAP_GENERATOR_MODEL_ID` |
| Kyosai Generator | 構造化JSONから家畜共済ドラフトを生成 | `amazon.nova-lite-v1:0` | `kyosaiModelId` | `KYOSAI_GENERATOR_MODEL_ID` |

補足:
- 生成系とは別に `generateHistorySummary` 用モデルもあります（`HISTORY_SUMMARY_MODEL_ID`）。
- モデル解決優先順位は `直接上書き > 環境変数 > デフォルト` です。
- Bedrock IAM は `amazon.nova-*` と `anthropic.claude-*` の呼び出しを許可しています。

## Transcribeカスタム語彙

- `TRANSCRIBE_VOCABULARY_NAME` を設定すると、Transcribeで語彙が有効になります。
- 未設定時は `vetvoice-ja-vocab-v1` を使用します（常時有効化のデフォルト）。
- 対象リージョンは `us-east-1` です。

例:

```bash
TRANSCRIBE_VOCABULARY_NAME=vetvoice-ja-vocab-v1
```

## 辞書・マスタファイル（人手で更新が必要）

以下は運用時に人間が更新する前提のファイルです。

| ファイル | 用途 | どこで使われるか | 更新責任 |
|---|---|---|---|
| `assets/dictionary.csv` | 略語・言い間違いの正規化辞書 | `Dictionary_Expander`（ルールベース展開） | 運用者（獣医ドメイン知識あり） |
| `assets/abbrev_lexicon.json` | 略語レキシコン正本（カテゴリ/揺れ候補） | 運用基盤（既存辞書・語彙更新の元データ） | 運用者＋開発者 |
| `assets/byoumei.csv` | 病名マスタ（病名コード候補） | `Master_Matcher`（`a[]` の病名照合） | 運用者（公式マスタ改定時） |
| `assets/shinryo_tensu_master_flat.csv` | 処置/点数マスタ | `Master_Matcher`（`p[]` の処置照合） | 運用者（点数改定時） |
| `assets/normalization_rules.json` | 正規化ルール（薬剤名・投与経路・canonical補正） | `Master_Matcher` / `runPipeline` | 運用者＋開発者（誤認識対策時） |
| `assets/transcribe-vocabulary-vetvoice-ja-v1.txt` | Transcribe Custom Vocabulary（読み補助） | Amazon Transcribe（音声認識前段） | 運用者（専門語追加時） |
| `assets/prompts/extractor.txt` | Extractor用プロンプト | Extractor LLM | 開発者（抽出仕様変更時） |

注意:
- `amplify/data/handlers/generated/*.ts` は自動生成物です。直接編集しません。
- 辞書/マスタ更新時は必ず `assets/` 側を編集します。
- 略語レキシコンの運用ルールは `doc/abbrev-lexicon.md` を参照してください。

## 辞書更新の反映手順（アプリ内辞書）

`dictionary.csv`, `byoumei.csv`, `shinryo_tensu_master_flat.csv`, `prompts/extractor.txt` を編集したら、次を実施します。

```bash
# 1) 生成モジュールを更新
npm run generate-assets

# 2) 変更確認（generated配下が更新される）
git status

# 3) 最低限の確認
npm test
npm run build
```

補足:
- CI/Amplify build でも `npm run generate-assets` は実行されますが、ローカルでも先に実行して差分をコミットする運用を推奨します。

## 正規化ルールの使い方（案3）

薬剤名や投与経路の置換ルールは `assets/normalization_rules.json` で管理します。  
追加・修正したら、以下を実行してください。

```bash
# 1) ルール編集
$EDITOR assets/normalization_rules.json

# 2) 生成モジュール更新
npm run generate-assets

# 3) 動作確認
npm test
npm run build
```

ポイント:
- `amplify/data/handlers/generated/normalization-rules-data.ts` は自動生成物です（直接編集しない）。
- ルール仕様（各キーの意味・適用順序・注意事項）は `doc/normalization-rules.md` を参照。

## Transcribe語彙ファイル更新手順（AWS側反映が必要）

`assets/transcribe-vocabulary-vetvoice-ja-v1.txt` を編集しただけでは、AWSのCustom Vocabularyには反映されません。  
以下を実行して AWS 側の語彙を更新してください。

```bash
# 必須: バケット名
export TRANSCRIBE_VOCAB_BUCKET=<your-bucket>

# 1) update/create（自動判定）
npm run transcribe:vocab:update

# 2) READY確認
npm run transcribe:vocab:status
```

`State` が `READY` になるまで待機し、`FAILED` の場合は `FailureReason` を確認して修正します。

利用可能な環境変数:

```bash
AWS_REGION=us-east-1
TRANSCRIBE_VOCABULARY_NAME=vetvoice-ja-vocab-v1
TRANSCRIBE_LANGUAGE_CODE=ja-JP
TRANSCRIBE_VOCAB_FILE=assets/transcribe-vocabulary-vetvoice-ja-v1.txt
TRANSCRIBE_VOCAB_BUCKET=<your-bucket>                         # 必須
TRANSCRIBE_VOCAB_S3_KEY=transcribe/transcribe-vocabulary-vetvoice-ja-v1.txt
```

### Transcribe語彙ファイルのフォーマット

`assets/transcribe-vocabulary-vetvoice-ja-v1.txt` はタブ区切りで、ヘッダは次の形式です。

```text
Phrase    SoundsLike    IPA    DisplayAs
```

- `Phrase`: 音声で認識させたい語（読み）
- `DisplayAs`: 最終文字起こしで表示したい語（漢字・正式表記）
- `SoundsLike` と `IPA`: 必要時のみ利用（通常は空欄で運用可能）

## モデル切り替え方法

### 1. 恒久設定（Lambda環境変数）

環境変数で固定したい場合は以下を設定します。

```bash
EXTRACTOR_MODEL_ID=anthropic.claude-haiku-4-5-20251001-v1:0
SOAP_GENERATOR_MODEL_ID=amazon.nova-lite-v1:0
KYOSAI_GENERATOR_MODEL_ID=amazon.nova-lite-v1:0
HISTORY_SUMMARY_MODEL_ID=amazon.nova-micro-v1:0
```

### 2. 開発時のみ上書き（UIセレクト）

開発モードの `PipelineEntryForm` では、Extractor / SOAP / Kyosai それぞれのモデルを実行時に切り替えできます。  
この上書きは `runPipeline` の引数（`extractorModelId`, `soapModelId`, `kyosaiModelId`）で渡されます。

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- AWS CLI 設定済み
- Amplify CLI (`npm install -g @aws-amplify/cli`)

### インストール

```bash
npm install
npx ampx sandbox
npm run dev
```

## テスト

```bash
npm test
npm run test:watch
npm run test:coverage
```

## 評価（固定セット + F1 + confirmed誤り率）

```bash
npm run eval
```

- デフォルト入力: `assets/eval/gold.v1.jsonl`
- 出力: `tmp/eval/latest.json`, `tmp/eval/latest.md`
- 詳細運用: `doc/evaluation-baseline.md`

## Extractorモデル比較（CSV + 人手正解メモ）

`runPipeline`（Cognito経由）ではなく、ローカルCLIからBedrockへ直接実行します。

```bash
npm run eval:extractor:compare -- tmp/model-comparison-sample.csv tmp/model-compare
```

- 入力CSV例: `tmp/model-comparison-sample.csv`
- 出力: `tmp/model-compare/comparison.latest.json`, `tmp/model-compare/comparison.latest.md`
- デフォルト比較モデル:
  - `anthropic.claude-haiku-4-5-20251001-v1:0`
  - `amazon.nova-premier-v1:0`
  - `amazon.nova-pro-v1:0`
- モデル上書き例:

```bash
npm run eval:extractor:compare -- tmp/model-comparison-sample.csv tmp/model-compare --models anthropic.claude-haiku-4-5-20251001-v1:0,amazon.nova-pro-v1:0
```

CSVヘッダ（`gold_human_note` 必須）:

```text
case_id,transcript_json_path,transcript_text,gold_human_note,gold_diseases,gold_procedures,gold_drugs,note
```

- `transcript_json_path` または `transcript_text` のどちらか必須
- `gold_human_note`: 人手の正解メモ（自由記述）
- `gold_diseases` / `gold_procedures` / `gold_drugs`: `|` 区切り（任意）
  - これらを入れた場合のみ `missing_count` / `misclassified_count` を自動集計
- 追加評価指標（A/P分離評価）:
  - `encounter_context`: `repro_screening_inferred` / `diagnostic_assessment` / `treatment_or_intervention` / `general_observation`
  - `p_without_utterance_count`: 発話根拠が薄い `p` 件数（低いほど良い）
  - `a_without_p_allowed_count`: `a` あり `p` 空（処置未発話）として許容された件数
  - `p_utterance_alignment_rate`: `p` が入ったケースで発話根拠に整合した割合

### 週次KPI運用（主指標: evidence_backed_fill_rate）

週次では `required_fields_fill_rate` ではなく、根拠付き充足率 `evidence_backed_fill_rate` を主KPIとして扱います。

```bash
# 1) モデル比較を実行
npm run eval:extractor:compare -- tmp/model-comparison-sample.csv tmp/model-compare

# 2) 週次KPIを更新（履歴追記 + 最新サマリ生成）
npm run eval:extractor:kpi -- tmp/model-compare/comparison.latest.json tmp/model-compare --target 0.5
```

- 出力:
  - `tmp/model-compare/kpi.weekly.history.v1.json`
  - `tmp/model-compare/kpi.weekly.latest.md`
- `--target-model <modelId>` を付けると特定モデルだけの達成判定にできます
- `--fail-on-below-target` を付けると目標未達時に非0終了（CI連携向け）

## SOAPモデル比較（Nova Lite vs GLM など）

ExtractorはHaiku 4.5固定で1回だけ実行し、同一ExtractedJSONを各SOAPモデルへ渡して比較します。

```bash
# 1) 40件向け入力テンプレ作成（既存比較CSVから先頭40件を抽出）
npm run eval:soap:template -- tmp/model-comparison-sample.csv tmp/soap-model-comparison-sample.40.csv --limit 40

# 2) SOAP比較（例: Nova Lite vs GLM 4.7）
npm run eval:soap:compare -- tmp/soap-model-comparison-sample.40.csv tmp/soap-model-compare --models amazon.nova-lite-v1:0,zai.glm-4.7
```

- 入力CSVヘッダ:
  - `case_id,transcript_json_path,transcript_text,gold_human_note,template_type,note`
- `template_type` は空欄推奨（自動選択）
- 出力:
  - `tmp/soap-model-compare/soap-comparison.latest.json`
  - `tmp/soap-model-compare/soap-comparison.latest.md`
  - `tmp/soap-model-compare/soap-scoring.template.csv`（人手採点用）

## デプロイ

```bash
npx ampx pipeline-deploy --branch main
git push origin main
```

## プロジェクト構造

```text
VetVoice/
├── amplify/              # Amplify Gen 2 バックエンド定義
│   ├── auth/             # Cognito認証設定
│   ├── data/             # GraphQLスキーマ + Lambda関数
│   ├── storage/          # S3ストレージ設定
│   └── backend.ts        # バックエンド統合
├── src/                  # Reactフロントエンド
│   ├── components/       # UIコンポーネント
│   ├── lib/              # ユーティリティ
│   └── App.tsx           # メインアプリ
├── assets/               # マスタデータ (CSV)
└── tests/                # テストファイル
```

## 開発ガイドライン

- コード変数名・関数名・コメント: 英語
- UI・ユーザー向けテキスト: 日本語
- TypeScript strict モード有効
- TDD (Test-Driven Development) 推奨
- プロパティベーステスト (`fast-check`) 活用

## ライセンス

Private - AWS 10000 AI Ideas コンペティション用 PoC
