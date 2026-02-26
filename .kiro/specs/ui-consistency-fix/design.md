# UI一貫性の欠如 — inline style依存とデザインシステム未適用 バグ修正設計

## Overview

VetVoiceの主要画面（PipelineEntryForm、App.tsx、VisitManager）でinline styleが大量に使用されており、`src/styles/design-system.css`で定義済みのデザイントークンや`src/components/ui/`の共通UIプリミティブが活用されていない。この修正では、inline styleをCSS Modules + デザイントークン参照に置き換え、不足しているUIプリミティブ（Select, Textarea, Tabs, Alert）を新規作成し、Cognito認証画面の日本語化・テーマ適用、index.cssのViteテンプレート残存スタイル除去を行う。

修正方針は「視覚的な見た目を変えずにスタイリング基盤を統一する」こと。ユーザーが体感する動作・外観の変化は最小限に抑え、内部のスタイリング手法のみを移行する。

## Glossary

- **Bug_Condition (C)**: UIコンポーネントがinline style定数またはハードコード色でスタイリングされており、design-system.cssトークンまたは共通UIプリミティブが使われていない状態
- **Property (P)**: すべてのUIコンポーネントがCSS Modules + design-system.cssトークン経由でスタイリングされ、共通UIプリミティブが適切に使用されている状態
- **Preservation**: パイプライン実行、画面遷移、ボタンクリック、タブ切替等の既存機能が修正前と同一に動作すること
- **inline style定数**: `FIELD_STYLE`, `SELECT_STYLE`, `PRIMARY_BUTTON_BASE_STYLE`, `cardStyle`, `infoRowStyle`等のJSオブジェクトとして定義されたスタイル
- **ハードコード色**: `#1e6bff`, `#0066cc`, `#fff0f0`, `#cc0000`, `#155724`, `#856404`等、CSSカスタムプロパティを経由せず直接指定された色値
- **CSS Modules**: `.module.css`拡張子のCSSファイルで、コンポーネントスコープのクラス名を生成する仕組み
- **デザイントークン**: `design-system.css`で定義された`--color-primary`, `--spacing-4`等のCSSカスタムプロパティ

## Bug Details

### Fault Condition

バグは、UIコンポーネントのスタイリングにinline style定数またはハードコード色が使用されている場合に発生する。具体的には、PipelineEntryForm（約15箇所）、App.tsx（約8箇所）、VisitManager（約12箇所）でdesign-system.cssトークンの代わりにJSオブジェクトまたはJSX内のstyle属性で色・サイズ・余白が直接指定されている。

**Formal Specification:**
```
FUNCTION isBugCondition(component)
  INPUT: component of type ReactComponent
  OUTPUT: boolean

  hasInlineStyleConstants := component contains JS style objects (FIELD_STYLE, SELECT_STYLE,
                             PRIMARY_BUTTON_BASE_STYLE, cardStyle, infoRowStyle, etc.)
  hasHardcodedColors := component contains color literals (#1e6bff, #0066cc, #fff0f0,
                        #cc0000, #155724, #856404, #242424, etc.)
                        NOT referencing var(--color-*)
  usesRawHtmlInsteadOfPrimitive := component uses <button style={...}> or <input style={...}>
                                   instead of <Button> or <Input> from ui/
  hasViteTemplateStyles := index.css contains color-scheme: light dark,
                           background-color: #242424, color: rgba(255,255,255,0.87)

  RETURN hasInlineStyleConstants
         OR hasHardcodedColors
         OR usesRawHtmlInsteadOfPrimitive
         OR hasViteTemplateStyles
END FUNCTION
```

### Examples

- PipelineEntryFormの「パイプライン実行」ボタン: `background: '#1e6bff'`がハードコードされており、`--color-primary: #1E6BFF`トークンが使われていない → 期待: `<Button variant="primary">`を使用
- App.tsxの「牛一覧」ボタン: `border: '1px solid #0066cc'`, `color: '#0066cc'`がハードコード → 期待: `<Button variant="secondary" size="sm">`を使用
- VisitManagerのエラー表示: `background: '#fff0f0'`, `border: '1px solid #cc0000'`, `color: '#cc0000'`がハードコード → 期待: `<Alert variant="error">`を使用
- VisitManagerの診療履歴ステータス色: `#155724`（完了）, `#856404`（進行中）がハードコード → 期待: `<Badge variant="success">`/`<Badge variant="warning">`を使用
- index.css: `background-color: #242424`, `color: rgba(255,255,255,0.87)`がViteテンプレート由来で残存 → 期待: 除去し、design-system.css + global.cssに一元化

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- PipelineEntryFormでのテキスト入力・音声ファイル・JSON入力・本番モードのパイプライン実行が正常に動作する
- PipelineEntryFormでのモデル選択変更が正しくパイプラインに渡される
- PipelineEntryFormでのタブ切替が正しく動作する
- App.tsxの「牛一覧」「開発モード」「サインアウト」ボタンが正しく動作する
- VisitManagerの「新規診療を開始」ボタン、診療履歴行クリック、「戻る」ボタンが正しく動作する
- `npm run build`でTypeScript型チェックとビルドが成功する
- 既存テストがすべてパスする

**Scope:**
inline styleからCSS Modulesへの移行はスタイリング手法の変更のみであり、コンポーネントのprops、state管理、イベントハンドラ、API呼び出しロジックには一切変更を加えない。

## Hypothesized Root Cause

このバグは初期開発時のプロトタイピングに起因する:

1. **段階的開発による技術的負債**: PipelineEntryForm、App.tsx、VisitManagerはデザインシステム確立前に実装され、inline styleでの迅速なプロトタイピングが行われた。その後design-system.cssとUIプリミティブが作成されたが、既存コンポーネントへの適用が行われなかった

2. **UIプリミティブの不足**: Select, Textarea, Tabs, Alertコンポーネントが未作成のため、PipelineEntryFormのセレクトボックス・テキストエリア・タブバー・エラー表示にinline styleが使われ続けた

3. **index.cssのViteテンプレート残存**: プロジェクト初期化時のViteテンプレートスタイルが`index.css`に残存し、後から追加された`design-system.css`のテーマ管理と責務が重複している

4. **Cognito Authenticatorのカスタマイズ未実施**: Amplify UIのAuthenticatorコンポーネントはデフォルト設定のまま使用されており、日本語化やVetVoiceテーマの適用が行われていない

## Correctness Properties

Property 1: Fault Condition - inline style・ハードコード色の除去

_For any_ UIコンポーネント（PipelineEntryForm, App.tsx, VisitManager）において、修正後のコードにinline style定数（FIELD_STYLE, SELECT_STYLE, PRIMARY_BUTTON_BASE_STYLE, cardStyle, infoRowStyle）またはハードコード色（#1e6bff, #0066cc, #fff0f0, #cc0000, #155724, #856404）が含まれていないこと。すべてのスタイリングがCSS Modules + design-system.cssトークン参照、または共通UIプリミティブ経由で行われていること。

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11, 2.12, 2.13**

Property 2: Preservation - 既存機能の動作保持

_For any_ ユーザー操作（パイプライン実行、タブ切替、画面遷移、ボタンクリック）において、修正後のコンポーネントが修正前と同一の機能的動作を行うこと。具体的には、同一のpropsに対して同一のイベントハンドラが発火し、同一のAPI呼び出しが行われ、同一の状態遷移が発生すること。

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12**


## Fix Implementation

### Changes Required

修正は以下の7つのカテゴリに分類される。根本原因分析に基づき、UIプリミティブ新規作成 → 各画面のリファクタリング → 基盤整理の順で実施する。

#### 1. 新規UIプリミティブ作成

**Select コンポーネント** (`src/components/ui/Select/`)

- `Select.tsx` + `Select.module.css`
- 既存Inputコンポーネントと同一のAPI設計パターン（label, error, helperText対応）
- Props: `label?`, `error?`, `helperText?`, `options`, `className?` + `React.SelectHTMLAttributes`
- design-system.cssトークン参照: `--color-border-input`, `--color-surface`, `--color-text-primary`, `--radius-md`, `--touch-target-min`
- focus/hover/disabled/errorステートをInputと統一

**Textarea コンポーネント** (`src/components/ui/Textarea/`)

- `Textarea.tsx` + `Textarea.module.css`
- 既存Inputコンポーネントと同一のAPI設計パターン
- Props: `label?`, `error?`, `helperText?`, `rows?`, `className?` + `React.TextareaHTMLAttributes`
- design-system.cssトークン参照: Inputと同一のトークンセット
- `resize: vertical`をデフォルトに設定

**Tabs コンポーネント** (`src/components/ui/Tabs/`)

- `Tabs.tsx` + `Tabs.module.css`
- Props: `tabs: { value: string; label: string }[]`, `activeTab: string`, `onTabChange: (value: string) => void`, `className?`
- `role="tablist"` + `role="tab"` + `aria-selected`のアクセシビリティ対応
- design-system.cssトークン参照: `--color-primary`, `--color-surface`, `--color-border-subtle`, `--radius-md`

**Alert コンポーネント** (`src/components/ui/Alert/`)

- `Alert.tsx` + `Alert.module.css`
- Props: `variant: 'success' | 'warning' | 'error' | 'info'`, `children`, `className?`
- `role="alert"`のアクセシビリティ対応
- design-system.cssトークン参照: `--color-danger-subtle`, `--color-danger`, `--color-warning-subtle`, `--color-warning`, `--color-success-subtle`, `--color-success`, `--color-info-subtle`, `--color-info`

#### 2. PipelineEntryFormリファクタリング

**File**: `src/components/PipelineEntryForm.tsx`
**New File**: `src/components/PipelineEntryForm.module.css`

**Specific Changes**:
1. inline style定数（`FIELD_STYLE`, `SELECT_STYLE`, `PRIMARY_BUTTON_BASE_STYLE`, `getPrimaryButtonStyle`）を削除
2. `<button style={getPrimaryButtonStyle(...)}>` → `<Button variant="primary" disabled={...} loading={...}>`に置換
3. `<select style={SELECT_STYLE}>` → `<Select>`に置換
4. `<textarea style={FIELD_STYLE}>` → `<Textarea>`に置換
5. タブバーのinline style → `<Tabs>`コンポーネントに置換
6. エラー表示のinline style → `<Alert variant="error">`に置換
7. 結果表示セクション（`pre`タグ等）のinline style → CSS Modulesクラスに移行
8. モデルオーバーライドセクションのgridレイアウト → CSS Modulesに移行
9. `ResultField`サブコンポーネントのinline style → CSS Modulesに移行

#### 3. App.tsxリファクタリング

**File**: `src/App.tsx`
**New File**: `src/App.module.css`

**Specific Changes**:
1. `<main style={{...}}>` → CSS Modulesクラス（`.appMain`）に移行
2. ヘッダーの`<div style={{...}}>` → CSS Modulesクラス（`.header`, `.headerActions`）に移行
3. 「牛一覧」ボタン → `<Button variant="secondary" size="sm">`に置換
4. 「開発モード」ボタン → `<Button variant="secondary" size="sm">`に置換（activeステートはCSS Modulesで管理）
5. 「サインアウト」ボタン → `<Button variant="ghost" size="sm">`に置換
6. ユーザーID表示のinline style → CSS Modulesクラスに移行
7. Authenticatorコンポーネントに日本語翻訳とVetVoiceテーマを適用

#### 4. VisitManagerリファクタリング

**File**: `src/components/VisitManager.tsx`
**New File**: `src/components/VisitManager.module.css`

**Specific Changes**:
1. `cardStyle`, `infoRowStyle`定数を削除
2. 牛情報カード → `<Card>`コンポーネントに置換
3. 情報行のinline style → CSS Modulesクラス（`.infoRow`, `.infoLabel`）に移行
4. 「新規診療を開始」ボタン → `<Button variant="primary">`に置換
5. 「← 戻る」ボタン → `<Button variant="ghost" size="sm">`に置換
6. エラー表示 → `<Alert variant="error">`に置換
7. 診療履歴行のinline style → CSS Modulesクラス（`.visitItem`）に移行
8. ステータス色（`#155724`, `#856404`） → `<Badge variant="success">`/`<Badge variant="warning">`に置換
9. 「読み込み中...」表示 → `<Spinner>`コンポーネントに置換
10. 新規診療セクション → `<Card>`コンポーネントに置換

#### 5. Cognito Authenticator日本語化・テーマ適用

**File**: `src/App.tsx`

**Specific Changes**:
1. Amplify UI の `I18n` を使用して日本語翻訳を設定（Sign In → サインイン、Username → ユーザー名、Password → パスワード等）
2. Amplify UI の `ThemeProvider` + `createTheme` を使用してVetVoiceのdesign-system.cssカラートークンをAuthenticatorに適用
3. `--amplify-colors-brand-primary` 等のAmplify UIテーマトークンをdesign-system.cssの値にマッピング

#### 6. index.css整理

**File**: `src/index.css`

**Specific Changes**:
1. Viteテンプレート由来のスタイルを除去:
   - `color-scheme: light dark` → 削除
   - `color: rgba(255, 255, 255, 0.87)` → 削除
   - `background-color: #242424` → 削除
   - `@media (prefers-color-scheme: light)` ブロック → 削除
2. `font-family`定義 → global.cssに既に存在するため削除
3. 残すべきスタイル: `body { margin: 0; min-width: 320px; min-height: 100vh; }`, `#root { width: 100%; }`, `pre`のwrap設定
4. 残すスタイルもglobal.css/reset.cssと重複する場合は統合を検討

#### 7. CSS Modules命名規則

すべての新規CSS Modulesファイルで以下の規則を適用:
- ファイル名: `ComponentName.module.css`（PascalCase）
- クラス名: camelCase（例: `.tabBar`, `.infoRow`, `.resultSection`）
- BEM風のバリアント: `--`区切り（例: `.tab--active`, `.alert--error`）
- design-system.cssトークンを`var(--token-name)`で参照

## Testing Strategy

### Validation Approach

テスト戦略は2フェーズで構成される: (1) 修正前のコードでバグ条件を確認するExploratoryテスト、(2) 修正後のコードで正しい動作と既存機能の保持を検証するFix/Preservationテスト。

本バグはスタイリング手法の移行であるため、主にビルド成功・型チェック・既存テストパスによる回帰防止と、コード静的解析によるinline style残存チェックが中心となる。

### Exploratory Fault Condition Checking

**Goal**: 修正前のコードでinline style・ハードコード色の使用箇所を特定し、バグ条件の存在を確認する。

**Test Plan**: ソースコード内のinline style定数とハードコード色をgrepで検出するテストを作成し、修正前のコードで失敗（= バグ条件が存在）することを確認する。

**Test Cases**:
1. **inline style定数検出テスト**: PipelineEntryForm.tsxに`FIELD_STYLE`, `SELECT_STYLE`, `PRIMARY_BUTTON_BASE_STYLE`が存在することを確認（修正前は検出される）
2. **ハードコード色検出テスト**: App.tsx, VisitManager.tsxに`#0066cc`, `#cc0000`等のハードコード色が存在することを確認（修正前は検出される）
3. **Viteテンプレートスタイル検出テスト**: index.cssに`#242424`, `rgba(255, 255, 255, 0.87)`が存在することを確認（修正前は検出される）

**Expected Counterexamples**:
- PipelineEntryForm.tsxで`FIELD_STYLE`が定義・使用されている
- App.tsxで`#0066cc`がstyle属性内に直接記述されている
- index.cssで`background-color: #242424`が存在する

### Fix Checking

**Goal**: 修正後のコードで、すべてのinline style定数とハードコード色が除去され、CSS Modules + デザイントークンに置き換えられていることを検証する。

**Pseudocode:**
```
FOR ALL component WHERE isBugCondition(component) DO
  result := analyzeStyleUsage(component_fixed)
  ASSERT result.inlineStyleConstants == []
  ASSERT result.hardcodedColors == []
  ASSERT result.cssModuleImports.length > 0
  ASSERT result.designTokenReferences.length > 0
END FOR
```

### Preservation Checking

**Goal**: 修正後のコードで、既存の機能的動作が変更されていないことを検証する。

**Pseudocode:**
```
FOR ALL userAction WHERE NOT isBugCondition(userAction) DO
  ASSERT functionalBehavior_original(userAction) == functionalBehavior_fixed(userAction)
END FOR
```

**Testing Approach**: 既存テストスイートの全パスに加え、TypeScriptビルド成功を回帰防止の主要手段とする。スタイリング変更はロジックに影響しないため、既存テストがそのまま保持テストとして機能する。

**Test Plan**: 修正前に既存テストがすべてパスすることを確認し、修正後も同一のテストがパスすることを検証する。

**Test Cases**:
1. **ビルド成功テスト**: `npm run build`が修正後もエラーなく完了する
2. **既存テストパステスト**: `npm test`が修正後もすべてパスする
3. **型チェックテスト**: `npx tsc --noEmit`が修正後もエラーなく完了する

### Unit Tests

- 新規UIプリミティブ（Select, Textarea, Tabs, Alert）の基本レンダリングテスト
- 各プリミティブのprops（variant, size, disabled, error等）に応じた正しいクラス名適用テスト
- Tabsコンポーネントのアクセシビリティ属性（role, aria-selected）テスト
- Alertコンポーネントのrole="alert"属性テスト

### Property-Based Tests

- 新規UIプリミティブに対して、任意のvariant/sizeの組み合わせで正しいCSSクラスが生成されることを検証
- Tabsコンポーネントに対して、任意のタブ配列とactiveTab値で正しいaria-selected状態が設定されることを検証

### Integration Tests

- PipelineEntryFormのタブ切替が修正後も正しく動作することを検証
- App.tsxのヘッダーボタンが修正後も正しいイベントハンドラを発火することを検証
- VisitManagerの画面遷移が修正後も正しく動作することを検証
