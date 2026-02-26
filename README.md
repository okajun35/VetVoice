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
