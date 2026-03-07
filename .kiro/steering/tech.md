# 技術スタック

## インフラストラクチャ

- プラットフォーム: AWS Amplify Gen 2（TypeScriptベースのコード定義）
- リージョン: `us-east-1`（バージニア北部）
- デプロイ:
  - バックエンド: `npx ampx pipeline-deploy --branch <branch>`
  - フロントエンド: Amplify Hosting（Git push -> 自動CI/CD）

## バックエンド

| サービス | 用途 |
|---------|------|
| AppSync (Amplify Data) | GraphQL API、モデルCRUD、カスタムクエリ |
| Cognito (Amplify Auth) | メールアドレスログイン |
| DynamoDB (Amplify Data) | `Cow` / `Visit` / `VisitEdit` モデル保存 |
| Lambda (Amplify Function) | `runPipeline` / `generateHistorySummary` |
| S3 (Amplify Storage) | `audio/*` 音声、`transcripts/*` Transcribe結果 |
| Amazon Transcribe | 日本語音声の非同期文字起こし |
| Amazon Bedrock | Extractor / SOAP / 共済 / 履歴サマリー生成 |

実装上の主要AWS SDKクライアント:

- `@aws-sdk/client-bedrock-runtime`
- `@aws-sdk/client-transcribe`
- `@aws-sdk/client-s3`
- `@aws-sdk/client-dynamodb`
- `@aws-sdk/lib-dynamodb`

## LLMモデル設定

モデル解決優先順位:

1. 実行時 override（`runPipeline` 引数）
2. Lambda環境変数
3. `amplify/data/handlers/model-config.ts` のデフォルト

現行のデフォルト設定:

| コンポーネント | デフォルトモデル | maxTokens | temperature | 用途 |
|---------------|------------------|-----------|-------------|------|
| Extractor | `us.anthropic.claude-haiku-4-5-20251001-v1:0` | 4096 | 0.1 | 構造化JSON抽出 |
| SOAP_Generator | `amazon.nova-lite-v1:0` | 2048 | 0.0 | SOAP生成 |
| Kyosai_Generator | `amazon.nova-lite-v1:0` | 2048 | 0.1 | 家畜共済ドラフト生成 |
| HistorySummary | `amazon.nova-micro-v1:0` | 1024 | 0.3 | 直近Visit要約 |

補足:

- `model-config.ts` には fallback 設定もあるが、通常のランタイムコードは `useFallback=false` で呼び出している。
- Anthropic / Nova の一部モデルは inference profile 経由を想定し、エイリアス正規化を実装している。

主要な環境変数:

- `EXTRACTOR_MODEL_ID`
- `SOAP_GENERATOR_MODEL_ID`
- `KYOSAI_GENERATOR_MODEL_ID`
- `HISTORY_SUMMARY_MODEL_ID`
- `TRANSCRIBE_VOCABULARY_NAME`
- `CLAUDE_SONNET_4_6_INFERENCE_PROFILE_ID`
- `CLAUDE_SONNET_4_INFERENCE_PROFILE_ID`
- `CLAUDE_HAIKU_4_5_INFERENCE_PROFILE_ID`
- `CLAUDE_3_7_SONNET_INFERENCE_PROFILE_ID`
- `CLAUDE_3_5_HAIKU_INFERENCE_PROFILE_ID`
- `NOVA_PREMIER_INFERENCE_PROFILE_ID`

LLMを使わない主要コンポーネント:

- `Dictionary_Expander`: ルールベース辞書展開
- `Parser`: JSON parse / validate / stringify
- `Master_Matcher`: 病名・処置・薬剤のファジーマッチ
- `Template_Selector`: キーワードベースのテンプレート選択
- `normalization-rules`: 抽出前後の正規化ルール適用

## フロントエンド

- React 18 + TypeScript（`strict: true`）
- Vite 5
- Amplify JS SDK（`aws-amplify`, `@aws-amplify/ui-react`）
- CSS Modules ベースのコンポーネントスタイリング
- デザイントークン:
  - `src/styles/design-system.css`
  - `src/styles/reset.css`
  - `src/styles/global.css`
- カスタムUIプリミティブ:
  - `src/components/ui/Button`
  - `src/components/ui/Input`
  - `src/components/ui/Modal`
  - `src/components/ui/Toast`
  - `src/components/ui/Card`
  - `src/components/ui/Badge`
  - `src/components/ui/Select`
  - `src/components/ui/Tabs`
  - `src/components/ui/Textarea`
  - `src/components/ui/Alert`
- 認証UI:
  - Amplify `Authenticator`
  - `App.tsx` で日本語化 (`I18n.putVocabularies`)
  - `ThemeProvider + createTheme` で独自テーマ適用
- QR関連:
  - `html5-qrcode`: QRスキャン
  - `qrcode`: QRコード生成
- テーマ管理:
  - `src/hooks/useTheme.ts`
  - `src/lib/theme.ts`
  - `localStorage` に `vetvoice-theme` を保存
- パスエイリアス: `@/* -> src/*`

## テスト

- テストランナー: Vitest
- DOM環境: `jsdom`
- UIテスト: Testing Library
- プロパティベーステスト: `fast-check`
- カバレッジ: `@vitest/coverage-v8`
- セットアップ: `tests/setup.ts`

現状:

- `tests/unit/`, `tests/property/`, `tests/integration/` に分割
- Playwright ベースのE2Eは現時点ではリポジトリに未導入

## 主要ライブラリ

```text
@aws-amplify/backend                # Amplify Gen 2 バックエンド定義
@aws-amplify/ui-react               # Cognito認証UI + テーマ適用
aws-amplify                         # Amplify クライアントSDK
@aws-sdk/client-bedrock-runtime     # Bedrock Converse API
@aws-sdk/client-transcribe          # Transcribe API
@aws-sdk/client-s3                  # S3アクセス
@aws-sdk/client-dynamodb            # DynamoDB低レベルクライアント
@aws-sdk/lib-dynamodb               # DynamoDB DocumentClient
html5-qrcode                        # QRコード読み取り
qrcode                              # QRコード生成
fast-check                          # プロパティベーステスト
@testing-library/react              # Reactコンポーネントテスト
@testing-library/user-event         # UI操作シミュレーション
vitest                              # テストランナー
tsx                                 # TypeScriptスクリプト実行
vite                                # 開発サーバー / ビルド
```

## コマンド一覧

### 開発

```bash
# Amplifyサンドボックス起動（ローカル開発用クラウドバックエンド）
npx ampx sandbox

# フロントエンド開発サーバー
npm run dev

# TypeScript型チェック
npx tsc --noEmit
```

### テスト

```bash
# 全テスト実行
npm run test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage

# 特定ファイルのテスト
npx vitest --run tests/unit/parser.test.ts

# プロパティベーステストのみ
npx vitest --run --grep "Property"
```

### Assets・評価・語彙運用

```bash
# assets から generated モジュールを再生成
npm run generate-assets

# 固定セット評価
npm run eval

# Extractor モデル比較
npm run eval:extractor:compare -- <input.csv> <outdir>

# 週次KPI更新
npm run eval:extractor:kpi -- <comparison.json> <outdir>

# SOAP比較テンプレ作成
npm run eval:soap:template -- <source.csv> <output.csv>

# SOAPモデル比較
npm run eval:soap:compare -- <template.csv> <outdir>

# SOAP採点のLLM補助
npm run eval:soap:assist -- <template.csv> <outdir> --model us.anthropic.claude-sonnet-4-6

# SOAP品質メトリクス計算
npm run eval:soap:metrics -- <assisted.csv>

# SOAP品質ゲート判定
npm run eval:soap:gate -- <assisted.csv>

# Transcribe語彙をAWSへ反映
npm run transcribe:vocab:update

# Transcribe語彙の状態確認
npm run transcribe:vocab:status
```

### デプロイ

```bash
# Amplifyバックエンドデプロイ
npx ampx pipeline-deploy --branch main

# フロントエンドはGit pushでAmplify Hostingが自動デプロイ
git push origin main
```

### リント

```bash
npm run lint
```

補足:

- 現在の `package.json` に `npm run format` は定義されていない。

## AWSインフラ戦略

### Kiro Power活用

AWS関連の調査・実装時は以下のKiro Powerを活用すること:

- `saas-builder` Power内の `aws-knowledge-mcp-server`:
  - `aws___search_documentation`: AWSドキュメント検索（Amplify, Bedrock, Transcribe等）
  - `aws___read_documentation`: AWSドキュメントページの読み込み
  - `aws___get_regional_availability`: リージョン別サービス可用性確認
  - `aws___recommend`: 関連ドキュメントの推薦

- `saas-builder` Power内の `awslabs.dynamodb-mcp-server`:
  - `dynamodb_data_modeling`: DynamoDBデータモデリング支援

### Amplify Gen 2 バックエンド定義パターン

```typescript
// amplify/backend.ts — 全リソースの統合エントリポイント
import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";

const backend = defineBackend({ auth, data, storage });

// CDK経由でIAMポリシーを追加（Bedrock, Transcribe, S3, DynamoDB）
```

### Lambda関数のパターン

```typescript
// amplify/data/run-pipeline.ts
// amplify/data/generate-history-summary.ts
// amplify/data/handlers/*.ts
```

- Lambda handler はオーケストレーション中心
- ビジネスロジックは `handlers/` 内の関数へ分離
- AWS SDK呼び出しは注入可能にしてテストでモックする
- assets 由来データは `scripts/generate-asset-modules.ts` で generated module 化する

### 無料利用枠の意識

PoC予算制約（$200クレジット）があるため:

- Bedrockモデルはコンポーネントごとにコストを分離して使う
- DynamoDB は Amplify Data 管理テーブルを最小構成で維持
- Lambda は `runPipeline` と `generateHistorySummary` の2関数に集約
- Transcribe はカスタム語彙を使いつつ、音声ファイルサイズ上限を意識する

## Reactコンポーネント規約

### 関数コンポーネント + Hooks

```typescript
import { useTheme } from "@/hooks/useTheme";

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <>
      <button onClick={() => setTheme("light")} aria-pressed={theme === "light"}>
        LIGHT
      </button>
      <button onClick={() => setTheme("dark")} aria-pressed={theme === "dark"}>
        DARK
      </button>
    </>
  );
}
```

### CSS Modulesの使用

```typescript
import styles from "./Button.module.css";

export function Button() {
  return <button className={styles.button}>Save</button>;
}
```

- 新規コンポーネントは原則 `.module.css` を併設する
- 共通プリミティブは `src/components/ui/` 配下に配置する

### 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネントファイル | `PascalCase.tsx` | `QRScanner.tsx` |
| フックファイル | `camelCase.ts` | `useTheme.ts` |
| ユーティリティファイル | `kebab-case.ts` | `offline-queue.ts` |
| コンポーネント名 | `PascalCase` | `VisitEditor` |
| 関数名 | `camelCase` | `generateSOAP` |
| 型・インターフェース | `PascalCase` | `ExtractedJSON` |
| 定数 | `UPPER_SNAKE_CASE` | `DEFAULT_TRANSCRIBE_VOCABULARY_NAME` |
| CSS Moduleクラス | `kebab-case` ベース | `button--primary` |
