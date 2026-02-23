# 技術スタック

## インフラストラクチャ

- プラットフォーム: AWS Amplify Gen 2（TypeScriptベースのコード定義）
- リージョン: us-east-1（バージニア北部）
- デプロイ: Amplify Hosting（Git push → 自動CI/CD）

## バックエンド

| サービス | 用途 |
|---------|------|
| AppSync (Amplify Data) | GraphQL API + 自動CRUD生成 |
| Cognito (Amplify Auth) | 認証（PoC用テストユーザー） |
| DynamoDB (Amplify Data) | Cow / Visit テーブル |
| Lambda (Amplify Function) | AIパイプライン処理 |
| S3 (Amplify Storage) | 音声ファイル保存 |
| Amazon Transcribe | 日本語音声→テキスト変換 |
| Amazon Bedrock | LLM（構造化抽出・SOAP生成・共済生成） |

## LLMモデル設定

コンポーネント別にモデルを設定可能。デフォルトはAmazon Nova（コンペ推奨）。

| コンポーネント | デフォルトモデル | 用途 |
|---------------|----------------|------|
| Extractor | Nova Pro | 高精度な構造化JSON抽出 |
| SOAP_Generator | Nova Lite | 低コストSOAP生成 |
| Kyosai_Generator | Nova Lite | 低コスト共済記録生成 |
| HistorySummary | Nova Micro | 最低コスト履歴サマリー |
| フォールバック | Claude Haiku/Sonnet | Nova精度不足時 |

LLMを使わないコンポーネント:
- Dictionary_Expander: ルールベース辞書ルックアップ（決定論的）
- Master_Matcher: ファジー文字列マッチング（決定論的）

## フロントエンド

- React 18 + TypeScript（strictモード）
- モバイルファーストのレスポンシブSPA
- Amplify JS SDK（`aws-amplify`, `@aws-amplify/ui-react`）
- html5-qrcode（QRコードスキャン）

## テスト

- テストランナー: Vitest
- プロパティベーステスト: fast-check
- E2Eテスト: Playwright（必要に応じて）

## 主要ライブラリ

````
@aws-amplify/backend       # Amplify Gen 2 バックエンド定義
aws-amplify                # Amplify クライアントSDK
@aws-sdk/client-bedrock-runtime  # Bedrock API
@aws-sdk/client-transcribe      # Transcribe API
fast-check                 # プロパティベーステスト
vitest                     # テストランナー
````

## コマンド一覧

### 開発

````bash
# Amplifyサンドボックス起動（ローカル開発用クラウドバックエンド）
npx ampx sandbox

# フロントエンド開発サーバー
npm run dev

# TypeScript型チェック
npx tsc --noEmit
````

### テスト

````bash
# 全テスト実行（ウォッチモードなし）
npx vitest --run

# 特定ファイルのテスト
npx vitest --run src/lib/parser.test.ts

# プロパティベーステストのみ
npx vitest --run --grep "Property"

# カバレッジ付き
npx vitest --run --coverage
````

### デプロイ

````bash
# Amplifyバックエンドデプロイ
npx ampx pipeline-deploy --branch main

# フロントエンドはGit push → Amplify Hostingが自動デプロイ
git push origin main
````

### リント・フォーマット

````bash
npm run lint
npm run format
````

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

````typescript
// amplify/backend.ts — 全リソースの統合エントリポイント
import { defineBackend } from "@aws-amplify/backend";
import { auth } from "./auth/resource";
import { data } from "./data/resource";
import { storage } from "./storage/resource";

const backend = defineBackend({ auth, data, storage });

// CDK経由でIAMポリシーを追加（Bedrock, Transcribe等）
````

### Lambda関数のパターン

````typescript
// amplify/data/handlers/xxx.ts — 純粋ロジック（テスト容易）
// amplify/data/run-pipeline.ts — オーケストレーター（Lambda handler）
````

- Lambda handler はオーケストレーションのみ
- ビジネスロジックは `handlers/` 内の純粋関数に分離
- AWS SDK呼び出しは注入可能にしてテスト時にモック

### 無料利用枠の意識

PoC予算制約（$200クレジット）があるため:
- Bedrockモデルはコスト順に Nova Micro < Lite < Pro を使い分け
- DynamoDB はオンデマンドモード（25GB無料枠内）
- Lambda は月100万リクエスト無料枠内
- Transcribe は月60分無料枠内

## Reactコンポーネント規約

### 関数コンポーネント + Hooks

````typescript
// コンポーネントは常に関数コンポーネント + TypeScript
interface Props {
  cowId: string;
  onSave: (visit: Visit) => void;
}

export function VisitEditor({ cowId, onSave }: Props) {
  const [state, setState] = useState<EditorState>(initialState);
  // ...
}
````

### カスタムHooksの活用

再利用可能なロジックはカスタムHooksに抽出:

````typescript
// src/hooks/useOnlineStatus.ts
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}
````

### 命名規則

| 対象 | 規則 | 例 |
|------|------|-----|
| コンポーネントファイル | PascalCase.tsx | `QRScanner.tsx` |
| フックファイル | camelCase.ts | `useOnlineStatus.ts` |
| ユーティリティファイル | kebab-case.ts | `offline-queue.ts` |
| コンポーネント名 | PascalCase | `VisitEditor` |
| 関数名 | camelCase | `generateSOAP` |
| 型・インターフェース | PascalCase | `ExtractedJSON` |
| 定数 | UPPER_SNAKE_CASE | `DEFAULT_MODEL_CONFIG` |
| CSS クラス | kebab-case | `visit-editor` |
