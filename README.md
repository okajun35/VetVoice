# VetVoice - 獣医音声診療記録システム

大動物（牛）を診療する日本の獣医師向け音声入力診療記録PoCシステム。

## 技術スタック

- **インフラ**: AWS Amplify Gen 2 (TypeScript-based CDK)
- **リージョン**: us-east-1 (バージニア北部)
- **フロントエンド**: React 18 + TypeScript + Vite
- **バックエンド**: AppSync (GraphQL) + Lambda + DynamoDB
- **認証**: Amplify Auth (Cognito)
- **ストレージ**: Amplify Storage (S3)
- **AI**: Amazon Bedrock (Nova / Claude), Amazon Transcribe

## セットアップ

### 前提条件

- Node.js 18以上
- npm または yarn
- AWS CLI設定済み
- Amplify CLI (`npm install -g @aws-amplify/cli`)

### インストール

```bash
# 依存関係のインストール
npm install

# Amplifyサンドボックス起動（ローカル開発用クラウドバックエンド）
npx ampx sandbox

# 別ターミナルでフロントエンド開発サーバー起動
npm run dev
```

### テスト

```bash
# 全テスト実行
npm test

# ウォッチモード
npm run test:watch

# カバレッジ付き
npm run test:coverage
```

### デプロイ

```bash
# Amplifyバックエンドデプロイ
npx ampx pipeline-deploy --branch main

# フロントエンドはGit push → Amplify Hostingが自動デプロイ
git push origin main
```

## プロジェクト構造

```
VetVoice/
├── amplify/              # Amplify Gen 2 バックエンド定義
│   ├── auth/            # Cognito認証設定
│   ├── data/            # GraphQLスキーマ + Lambda関数
│   ├── storage/         # S3ストレージ設定
│   └── backend.ts       # バックエンド統合
├── src/                 # React フロントエンド
│   ├── components/      # UIコンポーネント
│   ├── lib/            # ユーティリティ
│   └── App.tsx         # メインアプリ
├── assets/             # マスタデータ (CSV)
└── tests/              # テストファイル
```

## 開発ガイドライン

- コード変数名・関数名・コメント: 英語
- UI・ユーザー向けテキスト: 日本語
- TypeScript strictモード有効
- TDD (Test-Driven Development) を推奨
- プロパティベーステスト (fast-check) を活用

## ライセンス

Private - AWS 10000 AI Ideas コンペティション用PoC
