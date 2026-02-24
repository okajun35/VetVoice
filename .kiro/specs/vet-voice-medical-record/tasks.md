# 実装計画: 獣医音声診療記録システム (VetVoice)

## 概要

本実装計画は、AWS Amplify Gen 2を基盤とした獣医音声診療記録システムのコーディングタスクを定義する。QRコードスキャン→音声入力→構造化JSON→SOAP/家畜共済ドラフト生成のパイプラインを段階的に実装し、各段階でプロパティベーステストを含むテストを実施する。

設計原則「JSONを正にして、SOAP/共済は派生」に基づき、`transcript_raw`と`extracted_json`をSource of Truthとして保存し、SOAPサマリーおよび家畜共済記録は派生出力として扱う。

実装言語: TypeScript
インフラ: AWS Amplify Gen 2 (AppSync + Lambda + DynamoDB)
リージョン: us-east-1
LLM: Amazon Nova (デフォルト)、Claude (フォールバック)

## タスク

- [x] 1. プロジェクト初期化とAmplifyバックエンド基盤構築
  - Amplify Gen 2プロジェクトを初期化
  - React + TypeScriptのフロントエンドプロジェクトを初期化（Vite使用）
  - 認証 (Amplify Auth) を設定（`amplify/auth/resource.ts`）
  - ストレージ (Amplify Storage) を設定（`amplify/storage/resource.ts`）
  - `amplify/backend.ts`の基本構造を作成（auth、data、storageの統合定義）
  - 基本的なCI/CD設定を構成
  - _要件: 全体_

- [x] 2. データモデルとスキーマ定義
  - [x] 2.1 Amplify Dataスキーマとカスタムクエリを定義
    - `amplify/data/resource.ts`にCowSex enumを定義（FEMALE, MALE, CASTRATED）
    - `amplify/data/resource.ts`にCowモデルを定義（cowId, earTagNo, sex, breed, birthDate, parity, lastCalvingDate, name, farm, createdAt）
    - `amplify/data/resource.ts`にVisitモデルを定義
    - Visit用のGSI (`cowId-datetime-index`) を設定
    - カスタム型 `PipelineOutput` を定義
    - `runPipeline`カスタムクエリを定義（引数・レスポンス型・Lambda関数ハンドラー設定）
    - `generateHistorySummary`カスタムクエリを定義
    - _要件: 2.4, 13.1, 13.2, 13.3, 13.4, 14.1, 14.5, 17.1, 19.2, 19.3, 19.6_

  - [x] 2.2 データモデルのプロパティテストを作成
    - **Property 11: Visitデータ保全の不変条件**
    - **Property 12: Cow-Visit関連の整合性**
    - **検証: 要件 2.4, 10.5, 12.3, 12.4, 13.2, 13.4**

- [x] 3. JSON解析・検証コンポーネント (Parser) の実装
  - [x] 3.1 Parserコンポーネントを実装
    - `amplify/data/handlers/parser.ts`を作成
    - `parse()`関数: JSON文字列をExtracted_JSONオブジェクトに変換
    - `stringify()`関数: Extracted_JSONオブジェクトをJSON文字列に整形
    - スキーマバリデーション機能を実装
    - _要件: 6.1, 6.2, 6.3_

  - [x] 3.2 Parserのユニットテストを作成
    - 無効なJSON入力のテスト（型不一致、必須フィールド欠落）
    - エッジケースのテスト
    - _要件: 6.2_

  - [x] 3.3 Parserのプロパティテストを作成
    - **Property 1: Extracted_JSON ラウンドトリップ**
    - **検証: 要件 6.1, 6.3, 6.4**

- [x] 4. 辞書展開コンポーネント (Dictionary_Expander) の実装
  - [x] 4.1 初期辞書CSVファイルを作成
    - `assets/dictionary.csv`を作成（ヘッダー行 + 基本的な獣医学略語エントリ）
    - 初期エントリ例: 静脈注射/静注/IV、アンピシリン/アンピ/ABPC、筋肉注射/筋注/IM 等
    - _要件: 4.5_

  - [x] 4.2 Dictionary_Expanderコンポーネントを実装
    - `amplify/data/handlers/dictionary-expander.ts`を作成
    - CSV辞書ファイル (`assets/dictionary.csv`) の読み込み機能
    - ルールベースの略語→正式名称展開ロジック
    - 1対多マッピング対応（1正式名称→複数略語）
    - _要件: 4.1, 4.2, 4.4, 4.5, 15.4_

  - [x] 4.3 Dictionary_Expanderのユニットテストを作成
    - 具体的な略語展開例（「静注」→「静脈注射」、「アンピ」→「アンピシリン」）
    - 辞書に存在しない単語の保持確認
    - _要件: 4.2, 4.4_

  - [x] 4.4 Dictionary_Expanderのプロパティテストを作成
    - **Property 2: 辞書展開の正確性**
    - **Property 3: 辞書エントリのCRUDラウンドトリップ**
    - **検証: 要件 4.1, 4.3, 4.4, 4.5, 15.4**

- [x] 5. マスタデータ照合コンポーネント (Master_Matcher) の実装
  - [x] 5.1 Master_Matcherコンポーネントを実装
    - `amplify/data/handlers/master-matcher.ts`を作成
    - `byoumei.csv`と`shinryo_tensu_master_flat.csv`の読み込み
    - ファジー文字列マッチングアルゴリズムの実装
    - 上位3件の候補をConfidenceスコア付きで返却
    - Confidence閾値によるunconfirmedマーク機能
    - _要件: 7.1, 7.2, 7.3, 7.4, 15.5_

  - [x] 5.2 Master_Matcherのユニットテストを作成
    - 既知の病名照合例（「心のう炎」→byoumeiマスタの01-01）
    - 既知の処置照合例
    - _要件: 7.1, 7.2_

  - [x] 5.3 Master_Matcherのプロパティテストを作成
    - **Property 4: マスタ照合の候補提示**
    - **Property 5: Confidence閾値によるUnconfirmedマーク**
    - **検証: 要件 7.1, 7.2, 7.3, 7.4, 15.5**

- [x] 6. マスタデータCSVのLambdaバンドル設定
  - Dictionary_Expander、Master_MatcherがCSVを読み込む前提のため、CSVファイルをLambdaデプロイパッケージにバンドルする設定を行う
  - `amplify/data/run-pipeline.ts`のdefineFunction設定で`assets/`ディレクトリをバンドル対象に追加
  - `assets/byoumei.csv`、`assets/shinryo_tensu_master_flat.csv`、`assets/dictionary.csv`がLambda実行環境から読み込み可能であることを確認
  - 各ハンドラーのCSV読み込みパスがLambdaバンドル後のディレクトリ構造と一致することを確認
  - _要件: 7.1, 7.2, 4.5, 15.4, 15.5_

- [x] 7. チェックポイント - コアコンポーネントの動作確認
  - すべてのテストが成功することを確認
  - 質問があればユーザーに確認

- [x] 8. モデル設定レイヤーの実装
  - [x] 8.1 コンポーネント別モデル設定を実装
    - `amplify/data/handlers/model-config.ts`を作成
    - デフォルトモデル設定（Amazon Nova）を定義
    - フォールバックモデル設定（Claude）を定義
    - コンポーネント別モデル取得関数を実装
    - _要件: 15.1, 15.2, 15.3_

- [x] 9. 音声文字起こしコンポーネント (Transcriber) の実装
  - [x] 9.1 Transcriberコンポーネントを実装
    - `amplify/data/handlers/transcriber.ts`を作成
    - Amazon Transcribe API連携
    - S3から音声ファイル取得
    - 日本語音声のテキスト変換
    - カスタム語彙の設定（畜産・獣医学用語）
    - _要件: 3.1, 3.2, 3.3, 3.5_

  - [x] 9.2 Transcriberのユニットテストを作成
    - Transcribe APIのモックテスト
    - エラーハンドリングのテスト
    - _要件: 3.4_

- [x] 10. 構造化抽出コンポーネント (Extractor) の実装
  - [x] 10.1 Extractorコンポーネントを実装
    - `amplify/data/handlers/extractor.ts`を作成
    - Bedrock API連携（モデル設定レイヤー使用）
    - テキストからvital, s, o, a, pフィールドを抽出
    - 抽出できないフィールドはnullに設定
    - _要件: 5.1, 5.2, 5.3, 15.1_

  - [x] 10.2 Extractorのユニットテストを作成
    - Bedrock APIのモックテスト
    - 具体的なテキスト→JSON変換例
    - _要件: 5.1, 5.2_

  - [x] 10.3 Extractorのプロパティテストを作成
    - **Property 14: Extractor出力のスキーマ準拠**
    - **検証: 要件 5.1, 13.3**

- [x] 11. テンプレート選択コンポーネント (Template_Selector) の実装
  - [x] 11.1 テンプレート定義ファイルを作成
    - `src/lib/templates.ts`を作成
    - TemplateType型定義（general_soap, reproduction_soap, hoof_soap, kyosai）
    - TemplateDefinition型定義（type, label, requiredFields, keywords, soapPromptTemplate, kyosaiPromptTemplate）
    - TEMPLATES配列の定義（一般診療SOAP、繁殖SOAP、蹄病SOAP、家畜共済テンプレート）
    - 各テンプレートのキーワード、必須フィールド、プロンプトテンプレートを設定
    - _要件: 16.1_

  - [x] 11.2 Template_Selectorコンポーネントを実装
    - `amplify/data/handlers/template-selector.ts`を作成
    - `src/lib/templates.ts`のテンプレート定義を参照
    - キーワードベースの自動選択ロジック
    - 必須フィールド検証機能
    - _要件: 16.1, 16.2, 16.4_

  - [x] 11.3 Template_Selectorのユニットテストを作成
    - 繁殖キーワード含有時の`reproduction_soap`選択確認
    - 蹄病キーワード含有時の`hoof_soap`選択確認
    - デフォルト選択の確認
    - _要件: 16.2_

  - [x] 11.4 Template_Selectorのプロパティテストを作成
    - **Property 15: テンプレート定義の網羅性**
    - **Property 16: テンプレート自動選択の正確性**
    - **Property 17: テンプレート必須フィールド欠落通知**
    - **検証: 要件 16.1, 16.2, 16.4**

- [x] 12. SOAP生成コンポーネント (SOAP_Generator) の実装
  - [x] 12.1 SOAP_Generatorコンポーネントを実装
    - `amplify/data/handlers/soap-generator.ts`を作成
    - Bedrock API連携（モデル設定レイヤー使用）
    - テンプレートタイプに応じたプロンプト使用
    - Extracted_JSONからSOAP形式テキスト生成
    - Unconfirmed候補の「未確認」表示
    - _要件: 8.1, 8.2, 8.3, 8.4, 15.2, 16.3_

  - [x] 12.2 SOAP_Generatorのユニットテストを作成
    - Bedrock APIのモックテスト
    - 具体的なJSON→SOAP変換例
    - _要件: 8.1, 8.3_

  - [x] 12.3 SOAP_Generatorのプロパティテストを作成
    - **Property 6: SOAP生成のセクション含有**
    - **Property 7: SOAP未確認候補の明示**
    - **検証: 要件 8.1, 8.4**

- [x] 13. 家畜共済記録生成コンポーネント (Kyosai_Generator) の実装
  - [x] 13.1 Kyosai_Generatorコンポーネントを実装
    - `amplify/data/handlers/kyosai-generator.ts`を作成
    - Bedrock API連携（モデル設定レイヤー使用）
    - テンプレートタイプに応じたプロンプト使用
    - 必須フィールド（牛ID、診療日、病名、処置、薬剤、診療点数）を含む
    - 確定済みマスタコードの反映
    - Unconfirmed候補の空欄化と注記付与
    - _要件: 9.1, 9.2, 9.3, 9.4, 9.5, 15.3, 16.3_

  - [x] 13.2 Kyosai_Generatorのユニットテストを作成
    - Bedrock APIのモックテスト
    - 具体的なJSON→共済ドラフト変換例
    - _要件: 9.1, 9.2, 9.3_

  - [x] 13.3 Kyosai_Generatorのプロパティテストを作成
    - **Property 8: 家畜共済ドラフトの必須フィールド含有**
    - **Property 9: 家畜共済未確認候補のハンドリング**
    - **検証: 要件 9.1, 9.2, 9.3, 9.4**

- [x] 14. チェックポイント - AIパイプラインコンポーネントの動作確認
  - すべてのテストが成功することを確認
  - 質問があればユーザーに確認

- [x] 15. パイプラインオーケストレーター (runPipeline Lambda) の実装
  - [x] 15.1 runPipeline Lambda関数を実装
    - `amplify/data/run-pipeline.ts`を作成
    - エントリポイント別の処理分岐（PRODUCTION, TEXT_INPUT, AUDIO_FILE, JSON_INPUT）
    - 各コンポーネントの順序実行
    - 部分的成功時の結果保存
    - エラーハンドリングとリトライロジック
    - _要件: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 15.2 Visitデータ保全ロジックを実装
    - Visit保存時にtranscript_rawとextracted_jsonの削除を防止するバリデーションロジックを実装
    - 更新操作時にtranscript_rawとextracted_jsonがnullまたは空文字列に上書きされないことを保証
    - 既存のtranscript_raw/extracted_jsonが存在する場合、それらのフィールドを除外した更新を拒否するガード処理
    - _要件: 10.5, 12.3, 12.4_

  - [x] 15.3 runPipelineの統合テストを作成
    - 各エントリポイントからのパイプライン起動確認
    - エラーハンドリングのテスト
    - _要件: 14.5_

  - [x] 15.4 runPipelineのプロパティテストを作成
    - **Property 13: エントリポイント同一ロジック**
    - **検証: 要件 14.5**

- [x] 16. 診療履歴サマリー機能 (generateHistorySummary Lambda) の実装
  - [x] 16.1 generateHistorySummary Lambda関数を実装
    - `amplify/data/generate-history-summary.ts`を作成
    - DynamoDB GSIを使用した直近3件のVisit取得
    - Bedrock API連携（モデル設定レイヤー使用）
    - extracted_jsonからサマリー生成
    - Visitが0件の場合の「診療履歴がありません」返却
    - _要件: 17.1, 17.2, 17.3, 17.4_

  - [x] 16.2 generateHistorySummaryのユニットテストを作成
    - 0件/1件/3件のVisitでのサマリー生成例
    - DynamoDB GSIのモックテスト
    - _要件: 17.1, 17.3, 17.4_

  - [x] 16.3 generateHistorySummaryのプロパティテストを作成
    - **Property 18: 診療履歴サマリーのVisit件数制約**
    - **検証: 要件 17.1, 17.3**

- [x] 17. バックエンド統合とIAM権限設定
  - [x] 17.1 `amplify/backend.ts`にIAM権限を設定
    - タスク1で作成した`amplify/backend.ts`の基本構造にIAMポリシーを追加
    - Lambda関数にBedrock権限を付与
    - Lambda関数にTranscribe権限を付与
    - Lambda関数にS3読み取り権限を付与
    - _要件: 全体_

  - [x] 17.2 データ暗号化設定の確認と適用
    - DynamoDBテーブルのサーバーサイド暗号化（SSE）が有効であることを確認
    - S3バケットのサーバーサイド暗号化（SSE-S3またはSSE-KMS）が有効であることを確認
    - 必要に応じてAmplifyリソース定義に暗号化設定を明示的に追加
    - _要件: 12.1_

- [x] 18. フロントエンド: QRスキャナーコンポーネントの実装
  - [x] 18.1 QRScannerコンポーネントを実装
    - `src/components/QRScanner.tsx`を作成
    - html5-qrcodeライブラリを使用
    - QRコードからcow_idを読み取り
    - cow_id取得後にAmplify Data `getCow(cowId)`で牛情報を取得
    - 牛が存在する場合: 牛の基本情報画面に遷移
    - 牛が存在しない場合: 新規牛登録画面（CowRegistrationForm）に遷移（cow_idを自動入力）
    - エラーハンドリング（読み取り失敗）
    - _要件: 1.1, 1.2, 1.3, 19.1_

- [x] 18b. フロントエンド: 牛の登録フォームコンポーネントの実装
  - [x] 18b.1 CowRegistrationFormコンポーネントを実装
    - `src/components/CowRegistrationForm.tsx`を作成
    - cow_id（個体識別番号）の10桁バリデーション（先頭0を許容、正規表現: `/^\d{10}$/`）
    - 必須フィールド入力フォーム: cow_id（自動入力）、sex（性別セレクト）、breed（品種）、birth_date（生年月日）
    - 任意フィールド入力フォーム: ear_tag_no（耳標番号）、parity（産次）、last_calving_date（最終分娩日）、name（牛の名前）、farm（農場名）
    - 性別の表示用マッピング（FEMALE→雌、MALE→雄、CASTRATED→去勢）
    - Amplify Data `createCow()`を使用した保存処理
    - 登録完了後に牛の基本情報画面へ遷移
    - _要件: 19.1, 19.2, 19.3, 19.4, 19.6_

  - [x] 18b.2 牛の個体情報編集機能を実装
    - CowRegistrationFormに`mode="edit"`プロップを追加し編集モードを実装
    - CowDetailViewに全フィールド表示と「編集」ボタンを実装
    - CowListScreenから`view='edit'`でCowRegistrationForm(mode=edit)に遷移
    - Amplify Data `updateCow()`を使用した更新処理
    - _要件: 19.5_

- [x] 19. フロントエンド: 音声入力UIコンポーネントの実装
  - [x] 19.1 VoiceRecorderコンポーネントを実装
    - `src/components/VoiceRecorder.tsx`を作成
    - ブラウザのMediaRecorder APIを使用
    - 録音開始/停止機能
    - 音声データのAmplify Storageへのアップロード
    - リアルタイム録音状態の表示
    - _要件: 3.1, 3.2_

- [x] 20. フロントエンド: Visit管理UIの実装
  - [x] 20.1 Visit管理コンポーネントを実装
    - 牛の基本情報画面を作成（拡張Cowモデルの全フィールド表示: 個体識別番号、耳標番号、性別、品種、生年月日、産次、最終分娩日、名前、農場名）
    - 「新規診療」と「既存診療」の選択UI
    - 新規Visitレコードの作成
    - 既存Visitの表示と追記機能
    - _要件: 2.1, 2.2, 2.3, 2.4, 19.5_

- [x] 21. フロントエンド: 処理進捗表示コンポーネントの実装
  - [x] 21.1 PipelineProgressコンポーネントを実装
    - `src/components/PipelineProgress.tsx`を作成
    - パイプライン各段階（文字起こし→辞書展開→構造化抽出→マスタ照合→SOAP/共済生成）の進捗ステップ表示
    - 現在処理中の段階のハイライト表示
    - 処理完了/エラー時の状態表示
    - _要件: 11.2_

- [x] 22. フロントエンド: 確認・編集画面の実装
  - [x] 22.1 VisitEditorコンポーネントを実装
    - `src/components/VisitEditor.tsx`を作成
    - Extracted_JSONの表示と編集機能
    - Unconfirmed候補のハイライト表示
    - 手動確定機能（Confidenceの更新）
    - 保存機能（Visitレコードの永続化）
    - _要件: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [x] 22.2 VisitEditorのプロパティテストを作成
    - **Property 10: Unconfirmed候補の確定による状態更新**
    - **検証: 要件 10.3**

- [x] 23. フロントエンド: SOAPビューとKyosaiビューの実装
  - [x] 23.1 SOAPViewコンポーネントを実装
    - `src/components/SOAPView.tsx`を作成
    - SOAP形式テキストの表示
    - Unconfirmed箇所のハイライト
    - _要件: 8.1, 8.4_

  - [x] 23.2 KyosaiViewコンポーネントを実装
    - `src/components/KyosaiView.tsx`を作成
    - 家畜共済ドラフトの表示
    - 空欄フィールドと注記の表示
    - _要件: 9.1, 9.4_

- [x] 24. フロントエンド: テンプレート選択UIの実装
  - [x] 24.1 TemplateSelectorコンポーネントを実装
    - `src/components/TemplateSelector.tsx`を作成
    - 自動選択されたテンプレートの表示
    - 手動でのテンプレート変更機能
    - 必須フィールド欠落の通知表示
    - _要件: 16.2, 16.4_

- [x] 25. フロントエンド: 診療履歴サマリーUIの実装
  - [x] 25.1 HistorySummaryコンポーネントを実装
    - `src/components/HistorySummary.tsx`を作成
    - 「履歴サマリー」ボタン
    - generateHistorySummaryクエリの呼び出し
    - サマリーテキストの表示
    - _要件: 17.1_

- [x] 26. フロントエンド: Visit再利用機能の実装
  - [x] 26.1 VisitReuseコンポーネントを実装
    - `src/components/VisitReuse.tsx`を作成
    - 「前回のVisitをテンプレートとして使用」オプション
    - Visit選択UI
    - extracted_jsonのコピーと編集可能な表示
    - _要件: 18.1, 18.2, 18.3, 18.4_

  - [x] 26.2 Visit再利用ロジックを実装
    - `src/lib/visit-reuse.ts`を作成
    - `reuseVisit()`関数: cow_idとdatetimeを除外したコピー
    - _要件: 18.2, 18.4_

  - [x] 26.3 Visit再利用のプロパティテストを作成
    - **Property 19: Visit再利用の変換正確性**
    - **検証: 要件 18.2, 18.4**

- [x] 27. フロントエンド: 開発用エントリポイントUIの実装
  - [x] 27.1 DevEntryPointsコンポーネントを実装
    - `src/components/DevEntryPoints.tsx`を作成
    - PipelineEntryFormのmode="dev"ラッパーとして実装
    - 本番フロー、テキスト入力、音声ファイルアップロード、JSON入力の4モード（PipelineEntryForm内）
    - runPipelineクエリの呼び出し
    - _要件: 14.1, 14.2, 14.3, 14.4_

- [x] 28. オフラインキュー＆リトライ機能の実装
  - [x] 28.1 オフラインキューロジックを実装
    - `src/lib/offline-queue.ts`を作成
    - localStorageベースのキュー管理
    - IndexedDBでの音声データ一時保存
    - ネットワーク復帰時の自動リトライ
    - 指数バックオフ（最大5回リトライ）
    - _要件: 3.4, 3.6_

  - [x] 28.2 オフラインキューのユニットテストを作成
    - エンキュー、デキュー、リトライ上限のテスト
    - _要件: 3.6_

- [x] 29. チェックポイント - フロントエンド統合の動作確認
  - すべてのテストが成功することを確認
  - 質問があればユーザーに確認

- [x] 30. エンドツーエンド統合とワイヤリング
  - [x] 30.1 フロントエンドとバックエンドの統合
    - Amplify SDKの設定（amplify_outputs.json）
    - GraphQLクエリの呼び出し確認（VisitManager, PipelineEntryForm等）
    - 認証フローの統合（Authenticatorコンポーネント）
    - エラーハンドリングの統合
    - _要件: 全体_

  - [x] 30.2 メインアプリケーションの実装
    - `src/App.tsx`を作成
    - ルーティング設定（qr / register / visit_manager / cow_list）
    - 認証状態管理（Authenticatorラッパー）
    - 全コンポーネントの統合（QRScanner, CowRegistrationForm, VisitManager, CowListScreen, DevEntryPoints）
    - _要件: 全体_

- [ ] 31. パフォーマンス最適化
  - [ ] 31.1 処理性能の確認と最適化
    - 音声入力完了からSOAPドラフト表示までの時間計測
    - 30秒以内の処理完了を確認
    - _要件: 11.1_

- [ ] 32. 最終チェックポイント - 全機能の動作確認
  - すべてのテストが成功することを確認
  - エンドツーエンドフローの動作確認
  - 質問があればユーザーに確認

## 注記

- `*`マークの付いたサブタスクはオプションであり、MVP実装時にスキップ可能
- 各タスクは要件番号を参照し、トレーサビリティを確保
- プロパティテストは設計書の正確性プロパティに対応
- チェックポイントタスクで段階的な検証を実施
- 実装は段階的に進め、各段階で動作確認を行う
