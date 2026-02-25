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

## 3つのLLMコンポーネント（明示）

本システムはパイプライン内で **3つのLLM** を使います（`runPipeline` 内）。

| コンポーネント | 役割 | デフォルトモデル | 直接上書き（開発UI/API） | Lambda環境変数上書き |
|---|---|---|---|---|
| Extractor | 音声/テキストから構造化JSONを抽出 | `amazon.nova-pro-v1:0` | `extractorModelId` | `EXTRACTOR_MODEL_ID` |
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
| `assets/byoumei.csv` | 病名マスタ（病名コード候補） | `Master_Matcher`（`a[]` の病名照合） | 運用者（公式マスタ改定時） |
| `assets/shinryo_tensu_master_flat.csv` | 処置/点数マスタ | `Master_Matcher`（`p[]` の処置照合） | 運用者（点数改定時） |
| `assets/transcribe-vocabulary-vetvoice-ja-v1.txt` | Transcribe Custom Vocabulary（読み補助） | Amazon Transcribe（音声認識前段） | 運用者（専門語追加時） |
| `assets/prompts/extractor.txt` | Extractor用プロンプト | Extractor LLM | 開発者（抽出仕様変更時） |

注意:
- `amplify/data/handlers/generated/*.ts` は自動生成物です。直接編集しません。
- 辞書/マスタ更新時は必ず `assets/` 側を編集します。

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

## Transcribe語彙ファイル更新手順（AWS側反映が必要）

`assets/transcribe-vocabulary-vetvoice-ja-v1.txt` を編集しただけでは、AWSのCustom Vocabularyには反映されません。  
以下を実行して AWS 側の語彙を更新してください。

```bash
# 0) 例: 語彙ファイルをS3へ配置
aws s3 cp assets/transcribe-vocabulary-vetvoice-ja-v1.txt \
  s3://<your-bucket>/transcribe/transcribe-vocabulary-vetvoice-ja-v1.txt \
  --region us-east-1

# 1) 既存語彙を上書き更新
aws transcribe update-vocabulary \
  --vocabulary-name vetvoice-ja-vocab-v1 \
  --language-code ja-JP \
  --vocabulary-file-uri s3://<your-bucket>/transcribe/transcribe-vocabulary-vetvoice-ja-v1.txt \
  --region us-east-1

# 2) READY確認
aws transcribe get-vocabulary \
  --vocabulary-name vetvoice-ja-vocab-v1 \
  --region us-east-1 \
  --query '{Name:VocabularyName,State:VocabularyState,Failure:FailureReason}'
```

`State` が `READY` になるまで待機し、`FAILED` の場合は `FailureReason` を確認して修正します。

初回作成時（まだ語彙が存在しない場合）は `create-vocabulary` を使用します。

```bash
aws transcribe create-vocabulary \
  --vocabulary-name vetvoice-ja-vocab-v1 \
  --language-code ja-JP \
  --vocabulary-file-uri s3://<your-bucket>/transcribe/transcribe-vocabulary-vetvoice-ja-v1.txt \
  --region us-east-1
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
EXTRACTOR_MODEL_ID=amazon.nova-pro-v1:0
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
