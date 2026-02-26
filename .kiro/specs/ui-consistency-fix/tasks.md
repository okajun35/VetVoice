# 実装計画

- [x] 1. バグ条件探索テスト — inline style・ハードコード色の検出
  - **Property 1: Fault Condition** - inline style定数・ハードコード色の存在検出
  - **CRITICAL**: このプロパティベーステストは修正実装前に作成すること
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: このテストは期待される動作（inline style・ハードコード色が存在しないこと）をエンコードする — 修正後にパスすることでバグ修正を検証する
  - **GOAL**: 修正前のコードでinline style定数・ハードコード色が存在することを示すカウンターエグザンプルを表面化させる
  - **Scoped PBT Approach**: 対象ファイル（PipelineEntryForm.tsx, App.tsx, VisitManager.tsx, index.css）のソースコードを読み込み、以下を検証:
    - `isBugCondition(component)`: inline style定数（FIELD_STYLE, SELECT_STYLE, PRIMARY_BUTTON_BASE_STYLE, cardStyle, infoRowStyle）が存在しないこと
    - `isBugCondition(component)`: ハードコード色（#1e6bff, #0066cc, #fff0f0, #cc0000, #155724, #856404, #242424）がstyle属性内に存在しないこと
    - `isBugCondition(index.css)`: Viteテンプレート由来スタイル（color-scheme: light dark, background-color: #242424）が存在しないこと
  - テストファイル: `tests/property/ui-consistency.property.test.ts`
  - fast-checkで対象ファイルパスの配列からランダムに選択し、各ファイルのソースコードに対してバグ条件の不在を検証
  - 修正前のコードで実行 — **EXPECTED OUTCOME**: テスト FAIL（バグの存在を確認）
  - カウンターエグザンプルを記録（例: "PipelineEntryForm.tsxにFIELD_STYLEが定義されている", "App.tsxに#0066ccがstyle属性内に存在する"）
  - タスク完了条件: テストが作成され、実行され、失敗が記録されていること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.13_

- [x] 2. 保持プロパティテスト — 既存機能の動作保持（修正前に実行）
  - **Property 2: Preservation** - 既存テスト・ビルド成功 + UIプリミティブのprops検証
  - **IMPORTANT**: 観察ファースト方法論に従うこと
  - 観察: 修正前のコードで`npm run build`が成功することを確認
  - 観察: 修正前のコードで`npm test`が全テストパスすることを確認
  - 新規UIプリミティブ（Select, Textarea, Tabs, Alert）に対するプロパティベーステストを作成
  - テストファイル: `tests/property/ui-primitives.property.test.ts`
  - fast-checkで任意のvariant/props組み合わせを生成し、各プリミティブが正しいCSSクラス名・aria属性を出力することを検証:
    - Select: 任意のlabel, error, disabled状態で正しいクラス名が適用される
    - Textarea: 任意のlabel, error, rows値で正しいクラス名が適用される
    - Tabs: 任意のタブ配列とactiveTab値で正しいrole="tablist", role="tab", aria-selected属性が設定される
    - Alert: 任意のvariant（success, warning, error, info）でrole="alert"と正しいvariantクラスが適用される
  - 修正前のコードで実行（UIプリミティブ作成後、画面リファクタリング前） — **EXPECTED OUTCOME**: テスト PASS（ベースライン動作を確認）
  - タスク完了条件: テストが作成され、実行され、パスしていること
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 3. 新規UIプリミティブ作成

  - [x] 3.1 Selectコンポーネント作成
    - `src/components/ui/Select/Select.tsx` + `Select.module.css` + `index.ts`
    - Props: label?, error?, helperText?, options, className? + React.SelectHTMLAttributes
    - design-system.cssトークン参照: --color-border-input, --color-surface, --color-text-primary, --radius-md, --touch-target-min
    - focus/hover/disabled/errorステートをInputコンポーネントと統一
    - _Requirements: 2.1, 2.2_

  - [x] 3.2 Textareaコンポーネント作成
    - `src/components/ui/Textarea/Textarea.tsx` + `Textarea.module.css` + `index.ts`
    - Props: label?, error?, helperText?, rows?, className? + React.TextareaHTMLAttributes
    - design-system.cssトークン参照: Inputと同一のトークンセット
    - resize: verticalをデフォルトに設定
    - _Requirements: 2.1_

  - [x] 3.3 Tabsコンポーネント作成
    - `src/components/ui/Tabs/Tabs.tsx` + `Tabs.module.css` + `index.ts`
    - Props: tabs: { value: string; label: string }[], activeTab: string, onTabChange: (value: string) => void, className?
    - role="tablist" + role="tab" + aria-selectedのアクセシビリティ対応
    - design-system.cssトークン参照: --color-primary, --color-surface, --color-border-subtle, --radius-md
    - _Requirements: 2.3_

  - [x] 3.4 Alertコンポーネント作成
    - `src/components/ui/Alert/Alert.tsx` + `Alert.module.css` + `index.ts`
    - Props: variant: 'success' | 'warning' | 'error' | 'info', children, className?
    - role="alert"のアクセシビリティ対応
    - design-system.cssトークン参照: --color-danger-subtle, --color-danger, --color-warning-subtle, --color-warning, --color-success-subtle, --color-success
    - _Requirements: 2.4, 2.9_

  - [x] 3.5 UIプリミティブのユニットテスト作成
    - テストファイル: `tests/unit/ui-primitives.test.tsx`
    - Select: 基本レンダリング、label表示、error状態、disabled状態、options表示
    - Textarea: 基本レンダリング、label表示、error状態、rows指定
    - Tabs: 基本レンダリング、activeTab表示、onTabChangeコールバック、aria属性
    - Alert: 基本レンダリング、各variant表示、role="alert"属性
    - _Requirements: 2.1, 2.3, 2.4_

- [x] 4. PipelineEntryFormリファクタリング

  - [x] 4.1 PipelineEntryForm.module.css作成 + inline style定数削除
    - `src/components/PipelineEntryForm.module.css` を新規作成
    - FIELD_STYLE, SELECT_STYLE, PRIMARY_BUTTON_BASE_STYLE, getPrimaryButtonStyle等のinline style定数を削除
    - 対応するCSS Modulesクラスを作成（design-system.cssトークン参照）
    - _Bug_Condition: isBugCondition(PipelineEntryForm) where hasInlineStyleConstants = true_
    - _Expected_Behavior: inline style定数が除去され、CSS Modulesクラスに置換_
    - _Preservation: パイプライン実行、タブ切替、モデル選択の動作が変更されないこと_
    - _Requirements: 2.1, 2.2_

  - [x] 4.2 PipelineEntryFormのボタン・入力欄を共通UIプリミティブに置換
    - `<button style={...}>` を `<Button variant="primary">` に置換
    - `<select style={SELECT_STYLE}>` を `<Select>` に置換
    - `<textarea style={FIELD_STYLE}>` を `<Textarea>` に置換
    - _Bug_Condition: isBugCondition(PipelineEntryForm) where usesRawHtmlInsteadOfPrimitive = true_
    - _Expected_Behavior: 共通UIプリミティブが使用されている_
    - _Requirements: 2.1, 2.2_

  - [x] 4.3 PipelineEntryFormのタブバー・エラー表示・結果セクションをリファクタリング
    - タブバーのinline style を Tabs コンポーネントに置換
    - エラー表示のinline style を Alert variant="error" に置換
    - 結果表示セクション（preタグ等）のinline style を CSS Modulesクラスに移行
    - モデルオーバーライドセクションのgridレイアウト を CSS Modulesに移行
    - ResultFieldサブコンポーネントのinline style を CSS Modulesに移行
    - _Bug_Condition: isBugCondition(PipelineEntryForm) where hasHardcodedColors = true_
    - _Expected_Behavior: CSS Modules + design-system.cssトークン参照_
    - _Requirements: 2.3, 2.4_

  - [x] 4.4 PipelineEntryFormの回帰確認
    - npm run buildが成功すること
    - 既存テストがパスすること
    - getDiagnosticsでPipelineEntryForm.tsxに型エラーがないこと
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.11, 3.12_

- [x] 5. App.tsxリファクタリング

  - [x] 5.1 App.module.css作成 + ヘッダー・レイアウトのCSS Modules化
    - `src/App.module.css` を新規作成
    - main要素のinline style を CSS Modulesクラス（appMain）に移行
    - ヘッダーのdiv要素のinline style を CSS Modulesクラス（header, headerActions）に移行
    - ユーザーID表示のinline style を CSS Modulesクラスに移行
    - _Bug_Condition: isBugCondition(App) where hasInlineStyleConstants = true_
    - _Expected_Behavior: inline styleが除去され、CSS Modulesクラスに置換_
    - _Requirements: 2.5, 2.6_

  - [x] 5.2 App.tsxのヘッダーボタンを共通Buttonコンポーネントに置換
    - 「牛一覧」ボタン を Button variant="secondary" size="sm" に置換
    - 「開発モード」ボタン を Button variant="secondary" size="sm" に置換（activeステートはCSS Modulesで管理）
    - 「サインアウト」ボタン を Button variant="ghost" size="sm" に置換
    - _Bug_Condition: isBugCondition(App) where usesRawHtmlInsteadOfPrimitive = true AND hasHardcodedColors = true_
    - _Expected_Behavior: 共通Buttonコンポーネントが使用され、ハードコード色が除去_
    - _Requirements: 2.5_

  - [x] 5.3 App.tsxの回帰確認
    - npm run buildが成功すること
    - 既存テストがパスすること
    - getDiagnosticsでApp.tsxに型エラーがないこと
    - _Requirements: 3.5, 3.6, 3.7, 3.11, 3.12_

- [x] 6. VisitManagerリファクタリング

  - [x] 6.1 VisitManager.module.css作成 + inline style定数削除
    - `src/components/VisitManager.module.css` を新規作成
    - cardStyle, infoRowStyle等のinline style定数を削除
    - 対応するCSS Modulesクラスを作成（design-system.cssトークン参照）
    - 診療履歴行のinline style を CSS Modulesクラス（visitItem）に移行
    - _Bug_Condition: isBugCondition(VisitManager) where hasInlineStyleConstants = true_
    - _Expected_Behavior: inline style定数が除去され、CSS Modulesクラスに置換_
    - _Preservation: 新規診療開始、診療履歴行クリック、戻るボタンの動作が変更されないこと_
    - _Requirements: 2.7, 2.10_

  - [x] 6.2 VisitManagerのボタン・カード・エラー表示を共通UIプリミティブに置換
    - 牛情報カード を Card コンポーネントに置換
    - 「新規診療を開始」ボタン を Button variant="primary" に置換
    - 「← 戻る」ボタン を Button variant="ghost" size="sm" に置換
    - エラー表示 を Alert variant="error" に置換
    - 「読み込み中...」表示 を Spinner コンポーネントに置換
    - 新規診療セクション を Card コンポーネントに置換
    - _Bug_Condition: isBugCondition(VisitManager) where usesRawHtmlInsteadOfPrimitive = true_
    - _Expected_Behavior: 共通UIプリミティブが使用されている_
    - _Requirements: 2.7, 2.8, 2.9_

  - [x] 6.3 VisitManagerのステータス色をデザイントークンに移行
    - ステータス色（#155724, #856404）を Badge variant="success" / Badge variant="warning" に置換
    - 情報行のinline style を CSS Modulesクラス（infoRow, infoLabel）に移行
    - _Bug_Condition: isBugCondition(VisitManager) where hasHardcodedColors = true_
    - _Expected_Behavior: design-system.cssの --color-success / --color-warning トークン参照_
    - _Requirements: 2.10_

  - [x] 6.4 VisitManagerの回帰確認
    - npm run buildが成功すること
    - 既存テストがパスすること
    - getDiagnosticsでVisitManager.tsxに型エラーがないこと
    - _Requirements: 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 7. Cognito Authenticator日本語化・テーマ適用

  - [x] 7.1 Amplify UI I18nで日本語翻訳を設定
    - Sign In → サインイン、Username → ユーザー名、Password → パスワード等の翻訳辞書を定義
    - I18n.putVocabularies() + I18n.setLanguage('ja') を設定
    - _Bug_Condition: Cognito認証画面のUIラベルがデフォルト英語のまま_
    - _Expected_Behavior: UIラベルが日本語で表示される_
    - _Requirements: 2.11_

  - [x] 7.2 Amplify UI ThemeProviderでVetVoiceテーマを適用
    - createTheme()でdesign-system.cssのカラートークンをAmplify UIテーマトークンにマッピング
    - --amplify-colors-brand-primary 等をdesign-system.cssの値に設定
    - ThemeProviderでAuthenticatorコンポーネントをラップ
    - _Bug_Condition: Cognito認証画面にVetVoiceのデザインシステムが未適用_
    - _Expected_Behavior: design-system.cssのカラートークンがAmplify UIテーマ経由で適用_
    - _Requirements: 2.12_

  - [x] 7.3 Cognito画面の回帰確認
    - npm run buildが成功すること
    - getDiagnosticsでApp.tsxに型エラーがないこと
    - _Requirements: 3.7, 3.11_

- [x] 8. index.css整理

  - [x] 8.1 Viteテンプレート由来スタイルの除去
    - color-scheme: light dark を削除
    - color: rgba(255, 255, 255, 0.87) を削除
    - background-color: #242424 を削除
    - @media (prefers-color-scheme: light) ブロックを削除
    - font-family定義を削除（global.cssに既存）
    - 残すべきスタイル: body { margin: 0; min-width: 320px; min-height: 100vh; }, #root { width: 100%; }, preのwrap設定
    - _Bug_Condition: isBugCondition(index.css) where hasViteTemplateStyles = true_
    - _Expected_Behavior: Viteテンプレート由来スタイルが除去され、テーマ管理がdesign-system.cssに一元化_
    - _Requirements: 2.13_

  - [x] 8.2 index.css整理の回帰確認
    - npm run buildが成功すること
    - 既存テストがパスすること
    - _Requirements: 3.11, 3.12_

- [x] 9. 修正検証

  - [x] 9.1 バグ条件探索テストが修正後にパスすることを確認
    - **Property 1: Expected Behavior** - inline style定数・ハードコード色の除去検証
    - **IMPORTANT**: タスク1で作成した同一テストを再実行する — 新しいテストを書かないこと
    - タスク1のテストは期待される動作をエンコードしている
    - テストがパスすれば、期待される動作が満たされたことを確認
    - バグ条件探索テスト（tests/property/ui-consistency.property.test.ts）を再実行
    - **EXPECTED OUTCOME**: テスト PASS（バグ修正を確認）
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.13_

  - [x] 9.2 保持プロパティテストが修正後もパスすることを確認
    - **Property 2: Preservation** - 既存機能の動作保持検証
    - **IMPORTANT**: タスク2で作成した同一テストを再実行する — 新しいテストを書かないこと
    - 保持プロパティテスト（tests/property/ui-primitives.property.test.ts）を再実行
    - **EXPECTED OUTCOME**: テスト PASS（回帰なしを確認）
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 10. チェックポイント — 全テストパス確認
  - npm run build が成功すること
  - npm test が全テストパスすること
  - npx tsc --noEmit が型エラーなしで完了すること
  - 不明点があればユーザーに確認すること
