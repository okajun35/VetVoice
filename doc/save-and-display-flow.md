# 保存から表示までの仕組み（現状）

最終更新: 2026-02-25

## 概要

VetVoice では、`runPipeline` 実行結果は主に **DynamoDB (Visitテーブル)** に保存され、
音声・Transcribe JSON は **S3** に保存されます。

- SOAP / 共済テキスト: DynamoDB
- ExtractedJSON: DynamoDB
- 生音声: S3 (`audio/*`)
- Transcribe出力JSON: S3 (`transcripts/*`)

## 1. 保存処理（runPipeline）

`runPipeline` の保存対象は以下です。

- `visitId`
- `cowId`
- `datetime`
- `status`
- `transcriptRaw`
- `transcriptExpanded`
- `extractedJson`
- `soapText`
- `kyosaiText`
- `templateType`

### 保存先

1. DynamoDB `Visit` テーブル

- 保存実装: `amplify/data/run-pipeline.ts`
- スキーマ定義: `amplify/data/resource.ts`

2. S3

- 音声ファイル: `audio/*`
- Transcribe結果: `transcripts/*`
- 設定: `amplify/storage/resource.ts`

### 注意点

- DynamoDB 保存は "Save if possible" 方針です。
- 保存失敗時も pipeline のレスポンスは返却され、`warnings` に失敗内容が入ります。

## 2. 表示導線（UI）

保存済みデータは以下の導線で表示できます。

1. 牛一覧 (`CowListScreen`) で牛を選択
2. 牛詳細 (`CowDetailView`) で `診療開始` を押下
3. 診療履歴 (`VisitManager`) で対象 Visit を選択
4. 診療記録編集 (`VisitEditor`) で詳細表示

### 各画面で見える情報

- `VisitManager`: 診療履歴一覧（日時、ステータス、テンプレート等）
- `VisitEditor`:
  - `transcriptRaw`
  - `extractedJson`
  - `soapText`
  - `kyosaiText`

## 3. 開発画面との違い

`DevEntryPoints`（開発モード）は「実行直後の結果表示」が中心で、
通常導線のような履歴一覧表示とは役割が異なります。

- 開発モード: 即時結果検証
- 通常モード: 保存済み Visit の閲覧・編集

## 4. 関連ファイル

- `amplify/data/run-pipeline.ts`
- `amplify/data/resource.ts`
- `amplify/storage/resource.ts`
- `src/components/CowListScreen.tsx`
- `src/components/CowDetailView.tsx`
- `src/components/VisitManager.tsx`
- `src/components/VisitEditor.tsx`
