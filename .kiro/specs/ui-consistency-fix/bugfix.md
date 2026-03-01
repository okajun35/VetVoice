# バグ修正要件ドキュメント

## はじめに

VetVoiceアプリの主要画面（PipelineEntryForm、App.tsx、VisitManager）でinline styleが大量に使用されており、`src/styles/design-system.css`で定義済みのデザイントークンや`src/components/ui/`の共通UIプリミティブが活用されていない。これにより、画面間でボタン・入力欄・カード等の視覚仕様が不統一となり、デザイン変更時の保守コストが高い状態にある。また、`src/index.css`にVite初期テンプレート由来のスタイルが残存し、`design-system.css`のテーマ管理と責務が混在している。Cognito認証画面はデフォルトの英語UIのままで、VetVoiceのデザインシステムが未適用である。

## バグ分析

### 現在の動作（不具合）

1.1 WHEN PipelineEntryFormが表示される THEN ボタン・入力欄・セレクト・タブ・テキストエリアがすべてinline style定数（FIELD_STYLE, SELECT_STYLE, PRIMARY_BUTTON_BASE_STYLE等）で描画され、design-system.cssトークンが使われていない

1.2 WHEN PipelineEntryFormのボタンが表示される THEN ハードコード色（#1e6bff, #0066cc）がdesign-system.cssの`--color-primary`トークンの代わりに使われている

1.3 WHEN PipelineEntryFormのタブバーが表示される THEN タブがinline styleで描画され、共通UIプリミティブが使われていない

1.4 WHEN PipelineEntryFormのエラー表示が出る THEN エラーアラートがinline style（background: #fff0f0, border: #cc0000, color: #cc0000）で描画され、design-system.cssの`--color-danger`系トークンが使われていない

1.5 WHEN App.tsxのヘッダーが表示される THEN 「牛一覧」「開発モード」「サインアウト」ボタンがすべてinline styleで描画され、ハードコード色（#0066cc）が使われ、共通Buttonコンポーネントが使われていない

1.6 WHEN App.tsxのmainタグが表示される THEN inline style（padding, maxWidth, margin）が直接指定されている

1.7 WHEN VisitManagerが表示される THEN cardStyle, infoRowStyle等のinline style定数でカード・情報行が描画され、共通Cardコンポーネントが使われていない

1.8 WHEN VisitManagerの「新規診療を開始」ボタンが表示される THEN inline style（background: #0066cc）でハードコード色が使われ、共通Buttonコンポーネントが使われていない

1.9 WHEN VisitManagerのエラー表示が出る THEN エラーアラートがinline style（background: #fff0f0, border: #cc0000, color: #cc0000）で描画されている

1.10 WHEN VisitManagerの診療履歴リストが表示される THEN 各行がinline styleのbuttonで描画され、ステータス色（#155724, #856404）がハードコードされている

1.11 WHEN Cognito認証画面が表示される THEN UIラベル（Sign In, Username, Password等）がデフォルトの英語のままで日本語化されていない

1.12 WHEN Cognito認証画面が表示される THEN VetVoiceのdesign-system.cssのカラートークンやタイポグラフィが適用されていない

1.13 WHEN index.cssが読み込まれる THEN Vite初期テンプレートのスタイル（color-scheme: light dark, background-color: #242424, color: rgba(255,255,255,0.87)）がdesign-system.cssのテーマ管理と競合している

### 期待される動作（正しい状態）

2.1 WHEN PipelineEntryFormが表示される THEN ボタン・入力欄・セレクト・タブ・テキストエリアがCSS Modules + design-system.cssトークン経由で描画され、inline style定数（FIELD_STYLE, SELECT_STYLE, PRIMARY_BUTTON_BASE_STYLE）が除去されている

2.2 WHEN PipelineEntryFormのボタンが表示される THEN 共通Buttonコンポーネントまたはdesign-system.cssの`--color-primary`トークンを参照するCSS Modulesで描画され、ハードコード色が使われていない

2.3 WHEN PipelineEntryFormのタブバーが表示される THEN CSS Modulesでスタイリングされ、design-system.cssトークンを参照している

2.4 WHEN PipelineEntryFormのエラー表示が出る THEN エラーアラートがdesign-system.cssの`--color-danger`系トークンを参照するCSS Modulesで描画されている

2.5 WHEN App.tsxのヘッダーが表示される THEN ボタンが共通Buttonコンポーネントを使用し、design-system.cssトークンを参照している

2.6 WHEN App.tsxのmainタグが表示される THEN レイアウトがCSS Modulesまたはグローバルスタイルで管理され、inline styleが除去されている

2.7 WHEN VisitManagerが表示される THEN カード・情報行が共通CardコンポーネントまたはCSS Modules + design-system.cssトークンで描画され、inline style定数（cardStyle, infoRowStyle）が除去されている

2.8 WHEN VisitManagerの「新規診療を開始」ボタンが表示される THEN 共通Buttonコンポーネントを使用し、design-system.cssの`--color-primary`トークンを参照している

2.9 WHEN VisitManagerのエラー表示が出る THEN エラーアラートがdesign-system.cssの`--color-danger`系トークンを参照するスタイルで描画されている

2.10 WHEN VisitManagerの診療履歴リストが表示される THEN 各行がCSS Modulesで描画され、ステータス色がdesign-system.cssの`--color-success`/`--color-warning`トークンを参照している

2.11 WHEN Cognito認証画面が表示される THEN UIラベルが日本語（サインイン、ユーザー名、パスワード等）で表示される

2.12 WHEN Cognito認証画面が表示される THEN VetVoiceのdesign-system.cssのカラートークンがAmplify UIテーマ経由で適用されている

2.13 WHEN index.cssが読み込まれる THEN Vite初期テンプレート由来のスタイルが除去され、テーマ管理の責務がdesign-system.cssに一元化されている

### 変更されない動作（回帰防止）

3.1 WHEN PipelineEntryFormでテキスト入力モードのパイプラインを実行する THEN パイプライン実行が正常に動作し、結果が表示される

3.2 WHEN PipelineEntryFormで音声ファイルモードのパイプラインを実行する THEN S3アップロードとパイプライン実行が正常に動作する

3.3 WHEN PipelineEntryFormでモデル選択を変更する THEN 選択したモデルIDがパイプラインに正しく渡される

3.4 WHEN PipelineEntryFormでタブを切り替える THEN 対応するタブコンテンツが正しく表示される

3.5 WHEN App.tsxで「牛一覧」ボタンを押す THEN CowListScreen画面に遷移する

3.6 WHEN App.tsxで「開発モード」ボタンを押す THEN DevEntryPoints画面に切り替わる

3.7 WHEN App.tsxで「サインアウト」ボタンを押す THEN Cognito認証からサインアウトされる

3.8 WHEN VisitManagerで「新規診療を開始」ボタンを押す THEN PipelineEntryFormが表示される

3.9 WHEN VisitManagerで診療履歴の行を押す THEN VisitEditor画面に遷移する

3.10 WHEN VisitManagerで「戻る」ボタンを押す THEN 前の画面に戻る

3.11 WHEN `npm run build`を実行する THEN TypeScript型チェックとビルドが成功する

3.12 WHEN 既存テストを実行する THEN すべてのテストがパスする
