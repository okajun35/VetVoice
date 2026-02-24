# 要件定義書

## はじめに

DevEntryPoints（開発用エントリポイント）とVisitManager（新規診療フォーム）のパイプライン実行UIを共通コンポーネント（PipelineEntryForm）として切り出す。現在DevEntryPointsに実装されている4モードタブUI（テキスト入力、音声ファイル、JSON入力、本番録音）のロジックを再利用可能な形に抽出し、VisitManagerの「新規診療フォーム（実装予定）」プレースホルダーを実際のパイプライン実行UIに差し替える。

## 用語集

- **PipelineEntryForm**: パイプライン実行UIの共通コンポーネント。入力モード選択、パイプライン呼び出し、結果表示を担う
- **DevEntryPoints**: 開発用エントリポイントコンポーネント。PipelineEntryFormのdevモードラッパー
- **VisitManager**: 牛の診療管理コンポーネント。牛情報表示、診療履歴一覧、新規診療開始を担う
- **EntryPoint**: パイプラインの入力モード（TEXT_INPUT, AUDIO_FILE, JSON_INPUT, PRODUCTION）
- **PipelineResult**: runPipelineクエリの実行結果（visitId, extractedJson, soapText, kyosaiText等）
- **FormMode**: PipelineEntryFormの表示モード。devモードは全4タブとcowId入力欄を表示、productionモードは本番録音とテキスト入力のみ表示

## 要件

### 要件 1: PipelineEntryForm共通コンポーネントの作成

**ユーザーストーリー:** 開発者として、パイプライン実行UIを共通コンポーネントとして利用したい。これにより、DevEntryPointsとVisitManagerで同じUIロジックを重複なく使える。

#### 受入基準

1. THE PipelineEntryForm SHALL accept a cowId prop to identify the target cow for pipeline execution
2. THE PipelineEntryForm SHALL accept a mode prop with values dev or production to control which input tabs are displayed
3. THE PipelineEntryForm SHALL accept an optional onPipelineComplete callback prop that is invoked with the PipelineResult when pipeline execution succeeds
4. THE PipelineEntryForm SHALL accept an optional onError callback prop that is invoked with an error message string when pipeline execution fails
5. WHEN mode is dev, THE PipelineEntryForm SHALL display all four input tabs: テキスト入力, 音声ファイル, JSON入力, 本番（録音）
6. WHEN mode is dev, THE PipelineEntryForm SHALL display an editable cowId input field pre-filled with the cowId prop value
7. WHEN mode is production, THE PipelineEntryForm SHALL display only two input tabs: 本番（録音） and テキスト入力
8. WHEN mode is production, THE PipelineEntryForm SHALL hide the cowId input field and use the cowId prop value directly

### 要件 2: テキスト入力タブ

**ユーザーストーリー:** 獣医師として、診療テキストを直接入力してパイプラインを実行したい。これにより、音声入力が困難な環境でも診療記録を作成できる。

#### 受入基準

1. THE PipelineEntryForm SHALL provide a textarea for entering transcript text in the テキスト入力 tab
2. WHEN the user submits the テキスト入力 tab with non-empty text, THE PipelineEntryForm SHALL call runPipeline with entryPoint TEXT_INPUT, the current cowId, and the entered transcriptText
3. IF the user submits the テキスト入力 tab with empty text, THEN THE PipelineEntryForm SHALL display a validation error message

### 要件 3: 音声ファイルタブ（devモード専用）

**ユーザーストーリー:** 開発者として、音声ファイルをアップロードしてパイプラインをテストしたい。これにより、録音済みの音声データでパイプラインの動作を検証できる。

#### 受入基準

1. WHEN mode is dev, THE PipelineEntryForm SHALL display the 音声ファイル tab with a file input accepting audio files
2. WHEN the user selects an audio file, THE PipelineEntryForm SHALL display the file name and file size
3. WHEN the user submits the 音声ファイル tab with a selected file, THE PipelineEntryForm SHALL upload the file to S3 and then call runPipeline with entryPoint AUDIO_FILE
4. IF the user submits the 音声ファイル tab without selecting a file, THEN THE PipelineEntryForm SHALL display a validation error message
5. WHILE the audio file is uploading, THE PipelineEntryForm SHALL display an upload status indicator

### 要件 4: JSON入力タブ（devモード専用）

**ユーザーストーリー:** 開発者として、ExtractedJSONを直接入力してSOAP/共済生成のみをテストしたい。これにより、パイプラインの後半部分を個別に検証できる。

#### 受入基準

1. WHEN mode is dev, THE PipelineEntryForm SHALL display the JSON入力 tab with a monospace textarea for entering ExtractedJSON
2. WHEN the user submits the JSON入力 tab with valid JSON, THE PipelineEntryForm SHALL call runPipeline with entryPoint JSON_INPUT and the parsed extractedJson
3. IF the user submits the JSON入力 tab with empty text, THEN THE PipelineEntryForm SHALL display a validation error message
4. IF the user submits the JSON入力 tab with invalid JSON syntax, THEN THE PipelineEntryForm SHALL display a JSON parse error message

### 要件 5: 本番録音タブ

**ユーザーストーリー:** 獣医師として、マイクで音声を録音してパイプラインを実行したい。これにより、牛舎で手がふさがった状態でも診療記録を作成できる。

#### 受入基準

1. THE PipelineEntryForm SHALL display the 本番（録音） tab with the VoiceRecorder component
2. WHEN the VoiceRecorder completes audio upload, THE PipelineEntryForm SHALL call runPipeline with entryPoint PRODUCTION and the uploaded audioKey
3. IF the VoiceRecorder reports an error, THEN THE PipelineEntryForm SHALL display the error message

### 要件 6: パイプライン実行状態管理

**ユーザーストーリー:** 獣医師として、パイプラインの実行状態を把握したい。これにより、処理の進捗やエラーを確認できる。

#### 受入基準

1. WHILE the pipeline is executing, THE PipelineEntryForm SHALL disable all submit buttons and display a loading indicator
2. WHEN the pipeline execution succeeds, THE PipelineEntryForm SHALL invoke the onPipelineComplete callback with the PipelineResult
3. IF the pipeline execution fails with a GraphQL error, THEN THE PipelineEntryForm SHALL display the error messages and invoke the onError callback
4. IF the pipeline execution fails with a network error, THEN THE PipelineEntryForm SHALL display a generic error message and invoke the onError callback

### 要件 7: パイプライン実行結果の表示

**ユーザーストーリー:** 獣医師として、パイプラインの実行結果を確認したい。これにより、生成されたSOAPや共済テキストの内容を確認できる。

#### 受入基準

1. WHEN the pipeline execution succeeds, THE PipelineEntryForm SHALL display the result including visitId, cowId, and templateType
2. WHERE transcriptRaw is present in the result, THE PipelineEntryForm SHALL display the raw transcript text
3. WHERE transcriptExpanded is present in the result, THE PipelineEntryForm SHALL display the expanded transcript text
4. WHERE extractedJson is present in the result, THE PipelineEntryForm SHALL display the ExtractedJSON in a formatted pre block
5. WHERE soapText is present in the result, THE PipelineEntryForm SHALL display the SOAP text
6. WHERE kyosaiText is present in the result, THE PipelineEntryForm SHALL display the kyosai text
7. WHERE warnings are present in the result, THE PipelineEntryForm SHALL display the warnings as a list

### 要件 8: DevEntryPointsのリファクタリング

**ユーザーストーリー:** 開発者として、DevEntryPointsをPipelineEntryFormのラッパーとして簡素化したい。これにより、パイプラインUIの変更が一箇所で済む。

#### 受入基準

1. THE DevEntryPoints SHALL render PipelineEntryForm with mode set to dev
2. THE DevEntryPoints SHALL pass a default cowId value of test-cow-001 to PipelineEntryForm
3. THE DevEntryPoints SHALL maintain the existing heading text
4. WHEN the DevEntryPoints is rendered, THE DevEntryPoints SHALL produce the same visual output and functionality as the current implementation

### 要件 9: VisitManagerの新規診療フォーム統合

**ユーザーストーリー:** 獣医師として、VisitManagerから直接パイプラインを実行して新規診療を開始したい。これにより、牛の選択から診療記録作成までの流れがスムーズになる。

#### 受入基準

1. WHEN the user clicks the new visit button in VisitManager, THE VisitManager SHALL display PipelineEntryForm with mode set to production and the current cowId
2. WHEN the pipeline execution completes successfully in VisitManager, THE VisitManager SHALL navigate to the VisitEditor with the returned visitId
3. THE VisitManager SHALL display a back button in the new_visit view to return to the visit list
4. THE VisitManager SHALL replace the placeholder text with the PipelineEntryForm component