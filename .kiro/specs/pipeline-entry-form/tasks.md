# 実装計画: PipelineEntryForm

## 概要

DevEntryPointsの既存パイプライン実行UIロジックを共通コンポーネント `PipelineEntryForm` に抽出し、`mode` プロップ（dev/production）でタブ表示を制御する。リファクタリング後、DevEntryPointsは薄いラッパーとなり、VisitManagerの新規診療プレースホルダーをPipelineEntryForm（productionモード）に差し替える。

## Tasks

- [x] 1. PipelineEntryFormコンポーネントの作成
  - [x] 1.1 PipelineEntryForm の型定義とコンポーネント骨格を作成
    - `src/components/PipelineEntryForm.tsx` を新規作成
    - `PipelineResult`, `FormMode`, `TabMode`, `PipelineEntryFormProps` インターフェースを定義
    - `TABS_BY_MODE`, `TAB_LABELS` 定数を定義
    - 内部状態（activeTab, effectiveCowId, loading, error, result, transcriptText, audioFile, uploadStatus, jsonText）を定義
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.2 タブ表示制御とcowId制御を実装
    - `mode` プロップに応じて `TABS_BY_MODE[mode]` のタブのみ表示
    - `dev` モード: 編集可能なcowId入力欄を表示（初期値は `cowId` プロップ）
    - `production` モード: cowId入力欄を非表示、`cowId` プロップをそのまま使用
    - タブ切り替え時にエラーと結果をリセット
    - _Requirements: 1.5, 1.6, 1.7, 1.8_

  - [x] 1.3 テキスト入力タブを実装
    - textarea + バリデーション（空白のみ拒否）+ `runPipeline` 呼び出し
    - DevEntryPointsの `handleTextInputRun` ロジックを移植
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.4 音声ファイルタブを実装
    - ファイル選択 + メタデータ表示（ファイル名・サイズ）+ S3アップロード + `runPipeline` 呼び出し
    - アップロード中のステータス表示
    - DevEntryPointsの `handleAudioFileRun` ロジックを移植
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 1.5 JSON入力タブを実装
    - monospace textarea + バリデーション（空白拒否、JSON構文エラー検出）+ `runPipeline` 呼び出し
    - DevEntryPointsの `handleJsonInputRun` ロジックを移植
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.6 本番録音タブを実装
    - VoiceRecorderコンポーネントの組み込み
    - `onUploadComplete` で `runPipeline` 呼び出し、`onError` でエラー表示
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.7 パイプライン実行状態管理とコールバックを実装
    - loading中のボタン無効化 + ローディング表示
    - 成功時: `onPipelineComplete` コールバック呼び出し
    - GraphQLエラー時: エラーメッセージ表示 + `onError` コールバック呼び出し
    - ネットワークエラー時: 汎用エラーメッセージ表示 + `onError` コールバック呼び出し
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 1.8 パイプライン実行結果の表示を実装
    - ResultField群（visitId, cowId, templateType, transcriptRaw, transcriptExpanded, extractedJson, soapText, kyosaiText, warnings）
    - DevEntryPointsの結果表示ロジックを移植
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

- [x] 2. チェックポイント - PipelineEntryForm単体の動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. DevEntryPointsのリファクタリング
  - [x] 3.1 DevEntryPointsをPipelineEntryFormのラッパーにリファクタリング
    - `src/components/DevEntryPoints.tsx` を簡素化
    - `PipelineEntryForm` を `mode="dev"`, `cowId="test-cow-001"` でレンダリング
    - 見出しテキスト「開発用エントリポイント」を保持
    - 既存のパイプラインロジック・状態管理・タブUI・結果表示コードを削除
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

- [x] 4. VisitManagerの新規診療フォーム統合
  - [x] 4.1 VisitManagerの `new_visit` ビューにPipelineEntryFormを統合
    - プレースホルダー「新規診療フォーム（実装予定）」を `PipelineEntryForm` に差し替え
    - `mode="production"`, `cowId={cowId}` で表示
    - `onPipelineComplete` で `result.visitId` を取得し `VisitEditor` に遷移
    - `onError` でエラーメッセージを設定
    - 戻るボタンを保持
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 5. チェックポイント - 統合動作確認
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. テスト: ユニットテストとプロパティテスト
  - [x] 6.1 テストヘルパーにPipelineResult arbitraryを追加
    - `tests/helpers/generators.ts` に `pipelineResultArb` を追加
    - _Requirements: 7.1_

  - [x] 6.2 PipelineEntryFormのユニットテストを作成
    - `tests/unit/pipeline-entry-form.test.tsx` を新規作成
    - devモードでcowId入力欄表示、productionモードで非表示を検証
    - onPipelineComplete/onErrorコールバック呼び出しを検証
    - 音声ファイル未選択・空JSON入力のバリデーションエラーを検証
    - VoiceRecorder表示・完了時runPipeline呼び出し・エラー表示を検証
    - 実行中のボタン無効化・アップロードステータス表示を検証
    - _Requirements: 1.3, 1.4, 1.6, 1.8, 3.4, 3.5, 4.3, 5.1, 5.2, 5.3, 6.1, 6.2, 6.4_

  - [x] 6.3 DevEntryPointsリファクタリングのユニットテストを作成
    - `tests/unit/pipeline-entry-form.test.tsx` に追加
    - mode=devでPipelineEntryFormレンダリング、cowId=test-cow-001、見出しテキスト保持を検証
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 6.4 VisitManager統合のユニットテストを作成
    - `tests/unit/pipeline-entry-form.test.tsx` に追加
    - 新規診療ボタンでPipelineEntryForm表示、パイプライン完了時VisitEditor遷移、戻るボタン、プレースホルダー置換を検証
    - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [x] 6.5 プロパティテスト: モードによるタブ表示制御
    - `tests/property/pipeline-entry-form.property.test.tsx` を新規作成
    - **Property 1: モードによるタブ表示制御**
    - **Validates: Requirements 1.2, 1.5, 1.7**

  - [x] 6.6 プロパティテスト: 非空テキスト入力のパイプライン呼び出し
    - **Property 2: 非空テキスト入力のパイプライン呼び出し**
    - **Validates: Requirements 2.2**

  - [x] 6.7 プロパティテスト: 空白テキストのバリデーション拒否
    - **Property 3: 空白テキストのバリデーション拒否**
    - **Validates: Requirements 2.3**

  - [x] 6.8 プロパティテスト: 音声ファイルメタデータ表示
    - **Property 4: 音声ファイルメタデータ表示**
    - **Validates: Requirements 3.2**

  - [x] 6.9 プロパティテスト: 有効JSONのパイプライン呼び出し
    - **Property 5: 有効JSONのパイプライン呼び出し**
    - **Validates: Requirements 4.2**

  - [x] 6.10 プロパティテスト: 無効JSONのパースエラー表示
    - **Property 6: 無効JSONのパースエラー表示**
    - **Validates: Requirements 4.4**

  - [x] 6.11 プロパティテスト: GraphQLエラーの表示とコールバック
    - **Property 7: GraphQLエラーの表示とコールバック**
    - **Validates: Requirements 6.3**

  - [x] 6.12 プロパティテスト: 結果フィールドの完全表示
    - **Property 8: 結果フィールドの完全表示**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**

- [x] 7. 最終チェックポイント - 全テスト通過確認
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- PipelineEntryFormの実装はDevEntryPointsの既存コードをほぼそのまま移植し、`mode` プロップによるタブフィルタリングとcowId制御を追加する
- DevEntryPointsリファクタリング後は既存の見た目・機能が維持されることを確認
- `aws-amplify/data` の `generateClient` と `aws-amplify/storage` の `uploadData` はテスト時にモック化
- プロパティテストは `tests/helpers/generators.ts` の既存ジェネレータを活用し、`pipelineResultArb` を追加
