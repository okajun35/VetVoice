
# 設計書: モバイルファーストデザイン改善

## 概要

VetVoiceは牛舎・農場での利用を想定したモバイルファーストの獣医診療記録システムです。本設計では、統一されたデザインシステムを導入し、タッチ操作に最適化されたUIコンポーネントライブラリを構築します。CSS Modulesによるコンポーネントスコープのスタイリング、レスポンシブレイアウト、アクセシビリティ対応、ダークモード対応を実現します。

### 設計目標

1. **モバイルファースト**: 320px〜428pxのモバイル画面で最適な操作性を提供
2. **タッチ最適化**: 最小44x44pxのタッチターゲット、適切な間隔
3. **一貫性**: デザインシステムによる統一されたビジュアル言語
4. **保守性**: CSS Modulesによるコンポーネントスコープのスタイル
5. **アクセシビリティ**: WCAG AA準拠、スクリーンリーダー対応
6. **パフォーマンス**: 軽量なCSS、遅延ロード、最適化されたアセット

### 技術スタック

- **スタイリング**: CSS Modules (`.module.css`)
- **デザインシステム**: CSS Custom Properties (CSS Variables)
- **レイアウト**: CSS Flexbox, CSS Grid
- **テーマ**: CSS Custom Properties + `data-theme` attribute
- **アニメーション**: CSS Transitions, CSS Animations
- **アクセシビリティ**: ARIA attributes, semantic HTML

## アーキテクチャ

### デザインシステムアーキテクチャ

```
src/
├── styles/
│   ├── design-system.css          # Design system definition (CSS variables)
│   ├── reset.css                  # CSS reset
│   └── global.css                 # Global styles
├── components/
│   └── ui/                        # Common UI component library
│       ├── Button/
│       │   ├── Button.tsx
│       │   └── Button.module.css
│       ├── Card/
│       ├── Input/
│       ├── Badge/
│       ├── Spinner/
│       ├── Modal/
│       └── Toast/
├── hooks/
│   ├── useTheme.ts                # Theme management hook
│   └── useMediaQuery.ts           # Media query hook
└── lib/
    └── theme.ts                   # Theme utilities
```

### デザイントークンの詳細仕様

#### カラーパレット（医療寄りブルー基調）

##### Primary色

Primary色は、ボタン、リンク、アクティブ状態など、システム全体で最も頻繁に使用される色です。

- `--color-primary`: #1E6BFF（メインブルー）
- `--color-primary-hover`: #3B82FF（ホバー時）
- `--color-primary-active`: #1557D8（アクティブ時）
- `--color-on-primary`: #FFFFFF（Primary上の文字色）

##### 意味色トークン（Semantic Colors）

各意味色について、背景色（subtle）、文字色（on）、ボーダー（outline）をセットで定義します。これにより、コンポーネント実装時に色の選択で迷わなくなります。

**Success（成功）:**
- `--color-success`: #16A34A
- `--color-success-hover`: #15803D
- `--color-success-active`: #166534
- `--color-success-subtle`: #DCFCE7（背景色）
- `--color-on-success`: #FFFFFF（Success上の文字色）
- `--color-success-outline`: #16A34A（ボーダー色）

**Warning（警告）:**
- `--color-warning`: #F59E0B
- `--color-warning-hover`: #D97706
- `--color-warning-active`: #B45309
- `--color-warning-subtle`: #FEF3C7（背景色）
- `--color-on-warning`: #FFFFFF（Warning上の文字色）
- `--color-warning-outline`: #F59E0B（ボーダー色）

**Danger/Error（危険・エラー）:**
- `--color-danger`: #DC2626
- `--color-danger-hover`: #B91C1C
- `--color-danger-active`: #991B1B
- `--color-danger-subtle`: #FEE2E2（背景色）
- `--color-on-danger`: #FFFFFF（Danger上の文字色）
- `--color-danger-outline`: #DC2626（ボーダー色）

**Info（情報）:**
- `--color-info`: #2563EB
- `--color-info-hover`: #1D4ED8
- `--color-info-active`: #1E40AF
- `--color-info-subtle`: #DBEAFE（背景色）
- `--color-on-info`: #FFFFFF（Info上の文字色）
- `--color-info-outline`: #2563EB（ボーダー色）

##### 状態トークン（State Tokens）

**Disabled（無効化）:**
- `--color-disabled-bg`: #F3F4F6（無効化背景）
- `--color-disabled-text`: #9CA3AF（無効化文字色）
- `--color-disabled-border`: #D1D5DB（無効化ボーダー）

**Focus（フォーカス）:**
- `--color-focus-ring`: #93C5FD（フォーカスリング、太め推奨 3px）
- `--focus-ring-width`: 3px
- `--focus-ring-offset`: 2px

##### 境界線トークン（Border Tokens）

ダークテーマで枠が消えないよう、2段階の境界線を定義します。

**Light Theme:**
- `--color-border-subtle`: #E5E7EB（薄い境界線）
- `--color-border-strong`: #D0D7E2（濃い境界線）
- `--color-border-input`: #D1D5DB（入力フィールド境界線）

**Dark Theme:**
- `--color-border-subtle`: #374151（薄い境界線）
- `--color-border-strong`: #4B5563（濃い境界線）
- `--color-border-input`: #4B5563（入力フィールド境界線）

##### 背景・サーフェス・テキスト

**Light Theme:**
- `--color-background`: #F7F9FC（ページ背景）
- `--color-surface`: #FFFFFF（カード・モーダル背景）
- `--color-text-primary`: #0F172A（主要テキスト）
- `--color-text-secondary`: #64748B（副次テキスト）
- `--color-text-tertiary`: #94A3B8（三次テキスト）

**Dark Theme:**
- `--color-background`: #0F172A（ページ背景）
- `--color-surface`: #1E293B（カード・モーダル背景）
- `--color-text-primary`: #F1F5F9（主要テキスト）
- `--color-text-secondary`: #CBD5E1（副次テキスト）
- `--color-text-tertiary`: #94A3B8（三次テキスト）

##### on-colorルールの適用

すべてのカラートークンに対して、その上に表示される文字色を `--color-on-{name}` として定義します。これにより、コンポーネント実装時に文字色の選択で迷わなくなります。

**適用例:**
- Primary buttonの背景色: `var(--color-primary)`
- Primary buttonの文字色: `var(--color-on-primary)`
- Success badgeの背景色: `var(--color-success-subtle)`
- Success badgeの文字色: `var(--color-success)`（subtle背景の場合は元の色を使用）

#### デザイントークンの完全なCSS定義

```css
/* src/styles/design-system.css */

/* ========================================
   Light Theme (Default)
   ======================================== */
:root {
  /* Primary Colors */
  --color-primary: #1E6BFF;
  --color-primary-hover: #3B82FF;
  --color-primary-active: #1557D8;
  --color-on-primary: #FFFFFF;

  /* Semantic Colors - Success */
  --color-success: #16A34A;
  --color-success-hover: #15803D;
  --color-success-active: #166534;
  --color-success-subtle: #DCFCE7;
  --color-on-success: #FFFFFF;
  --color-success-outline: #16A34A;

  /* Semantic Colors - Warning */
  --color-warning: #F59E0B;
  --color-warning-hover: #D97706;
  --color-warning-active: #B45309;
  --color-warning-subtle: #FEF3C7;
  --color-on-warning: #FFFFFF;
  --color-warning-outline: #F59E0B;

  /* Semantic Colors - Danger/Error */
  --color-danger: #DC2626;
  --color-danger-hover: #B91C1C;
  --color-danger-active: #991B1B;
  --color-danger-subtle: #FEE2E2;
  --color-on-danger: #FFFFFF;
  --color-danger-outline: #DC2626;

  /* Semantic Colors - Info */
  --color-info: #2563EB;
  --color-info-hover: #1D4ED8;
  --color-info-active: #1E40AF;
  --color-info-subtle: #DBEAFE;
  --color-on-info: #FFFFFF;
  --color-info-outline: #2563EB;

  /* State Colors - Disabled */
  --color-disabled-bg: #F3F4F6;
  --color-disabled-text: #9CA3AF;
  --color-disabled-border: #D1D5DB;

  /* State Colors - Focus */
  --color-focus-ring: #93C5FD;
  --focus-ring-width: 3px;
  --focus-ring-offset: 2px;

  /* Border Colors */
  --color-border-subtle: #E5E7EB;
  --color-border-strong: #D0D7E2;
  --color-border-input: #D1D5DB;

  /* Background & Surface */
  --color-background: #F7F9FC;
  --color-surface: #FFFFFF;

  /* Text Colors */
  --color-text-primary: #0F172A;
  --color-text-secondary: #64748B;
  --color-text-tertiary: #94A3B8;

  /* Typography */
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-family-mono: "SF Mono", Monaco, "Cascadia Code", "Roboto Mono", Consolas, "Courier New", monospace;

  --font-size-xs: 0.75rem;    /* 12px */
  --font-size-sm: 0.875rem;   /* 14px */
  --font-size-base: 1rem;     /* 16px */
  --font-size-lg: 1.125rem;   /* 18px */
  --font-size-xl: 1.25rem;    /* 20px */
  --font-size-2xl: 1.5rem;    /* 24px */
  --font-size-3xl: 1.875rem;  /* 30px */

  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;

  --line-height-tight: 1.25;
  --line-height-normal: 1.5;
  --line-height-relaxed: 1.75;

  /* Spacing (4px base unit) */
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-10: 2.5rem;   /* 40px */
  --spacing-12: 3rem;     /* 48px */

  /* Border Radius */
  --radius-sm: 0.25rem;   /* 4px */
  --radius-md: 0.5rem;    /* 8px */
  --radius-lg: 0.75rem;   /* 12px */
  --radius-xl: 1rem;      /* 16px */
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Z-index */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
  --z-toast: 1080;

  /* Touch Targets */
  --touch-target-min: 44px;
}

/* ========================================
   Dark Theme
   ======================================== */
[data-theme="dark"] {
  /* Primary Colors (slightly lighter for better contrast) */
  --color-primary: #4DA3FF;
  --color-primary-hover: #66B3FF;
  --color-primary-active: #3B82FF;
  --color-on-primary: #0F172A;

  /* Semantic Colors - Success */
  --color-success: #22C55E;
  --color-success-hover: #16A34A;
  --color-success-active: #15803D;
  --color-success-subtle: #14532D;
  --color-on-success: #FFFFFF;
  --color-success-outline: #22C55E;

  /* Semantic Colors - Warning */
  --color-warning: #FBB040;
  --color-warning-hover: #F59E0B;
  --color-warning-active: #D97706;
  --color-warning-subtle: #78350F;
  --color-on-warning: #0F172A;
  --color-warning-outline: #FBB040;

  /* Semantic Colors - Danger/Error */
  --color-danger: #EF4444;
  --color-danger-hover: #DC2626;
  --color-danger-active: #B91C1C;
  --color-danger-subtle: #7F1D1D;
  --color-on-danger: #FFFFFF;
  --color-danger-outline: #EF4444;

  /* Semantic Colors - Info */
  --color-info: #3B82F6;
  --color-info-hover: #2563EB;
  --color-info-active: #1D4ED8;
  --color-info-subtle: #1E3A8A;
  --color-on-info: #FFFFFF;
  --color-info-outline: #3B82F6;

  /* State Colors - Disabled */
  --color-disabled-bg: #374151;
  --color-disabled-text: #6B7280;
  --color-disabled-border: #4B5563;

  /* State Colors - Focus */
  --color-focus-ring: #60A5FA;

  /* Border Colors */
  --color-border-subtle: #374151;
  --color-border-strong: #4B5563;
  --color-border-input: #4B5563;

  /* Background & Surface */
  --color-background: #0F172A;
  --color-surface: #1E293B;

  /* Text Colors */
  --color-text-primary: #F1F5F9;
  --color-text-secondary: #CBD5E1;
  --color-text-tertiary: #94A3B8;

  /* Shadows (darker for dark theme) */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.3);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.4), 0 4px 6px -2px rgba(0, 0, 0, 0.3);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.4), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
}

/* ========================================
   Reduced Motion Support
   ======================================== */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

#### コンポーネントでのデザイントークン使用例

##### Button Component

```css
/* src/components/ui/Button/Button.module.css */

.button {
  /* Base styles */
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-2);
  
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  
  cursor: pointer;
  transition: all var(--transition-fast);
  
  /* Touch target */
  min-height: var(--touch-target-min);
  min-width: var(--touch-target-min);
}

/* Primary variant */
.button--primary {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
  border-color: var(--color-primary);
}

.button--primary:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.button--primary:active:not(:disabled) {
  background-color: var(--color-primary-active);
  border-color: var(--color-primary-active);
}

/* Secondary variant */
.button--secondary {
  background-color: transparent;
  color: var(--color-primary);
  border-color: var(--color-primary);
}

.button--secondary:hover:not(:disabled) {
  background-color: var(--color-primary);
  color: var(--color-on-primary);
}

/* Danger variant */
.button--danger {
  background-color: var(--color-danger);
  color: var(--color-on-danger);
  border-color: var(--color-danger);
}

.button--danger:hover:not(:disabled) {
  background-color: var(--color-danger-hover);
  border-color: var(--color-danger-hover);
}

.button--danger:active:not(:disabled) {
  background-color: var(--color-danger-active);
  border-color: var(--color-danger-active);
}

/* Ghost variant */
.button--ghost {
  background-color: transparent;
  color: var(--color-text-primary);
  border-color: transparent;
}

.button--ghost:hover:not(:disabled) {
  background-color: var(--color-border-subtle);
}

/* Disabled state */
.button:disabled {
  background-color: var(--color-disabled-bg);
  color: var(--color-disabled-text);
  border-color: var(--color-disabled-border);
  cursor: not-allowed;
  opacity: 0.6;
}

/* Focus state */
.button:focus-visible {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* Sizes */
.button--sm {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
}

.button--md {
  padding: var(--spacing-3) var(--spacing-4);
  font-size: var(--font-size-base);
}

.button--lg {
  padding: var(--spacing-4) var(--spacing-6);
  font-size: var(--font-size-lg);
}

.button--full {
  width: 100%;
}
```

##### Badge Component

```css
/* src/components/ui/Badge/Badge.module.css */

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  
  font-family: var(--font-family-base);
  font-weight: var(--font-weight-medium);
  line-height: var(--line-height-tight);
  
  border-radius: var(--radius-full);
  border: 1px solid transparent;
}

/* Success variant */
.badge--success {
  background-color: var(--color-success-subtle);
  color: var(--color-success);
  border-color: var(--color-success-outline);
}

/* Warning variant */
.badge--warning {
  background-color: var(--color-warning-subtle);
  color: var(--color-warning);
  border-color: var(--color-warning-outline);
}

/* Error variant */
.badge--error {
  background-color: var(--color-danger-subtle);
  color: var(--color-danger);
  border-color: var(--color-danger-outline);
}

/* Info variant */
.badge--info {
  background-color: var(--color-info-subtle);
  color: var(--color-info);
  border-color: var(--color-info-outline);
}

/* Neutral variant */
.badge--neutral {
  background-color: var(--color-border-subtle);
  color: var(--color-text-primary);
  border-color: var(--color-border-strong);
}

/* Sizes */
.badge--sm {
  padding: var(--spacing-1) var(--spacing-2);
  font-size: var(--font-size-xs);
}

.badge--md {
  padding: var(--spacing-2) var(--spacing-3);
  font-size: var(--font-size-sm);
}
```

##### Input Component

```css
/* src/components/ui/Input/Input.module.css */

.input {
  /* Base styles */
  width: 100%;
  padding: var(--spacing-3) var(--spacing-4);
  
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  
  color: var(--color-text-primary);
  background-color: var(--color-surface);
  
  border: 2px solid var(--color-border-input);
  border-radius: var(--radius-md);
  
  transition: all var(--transition-fast);
  
  /* Touch target */
  min-height: var(--touch-target-min);
}

.input::placeholder {
  color: var(--color-text-tertiary);
}

/* Hover state */
.input:hover:not(:disabled) {
  border-color: var(--color-border-strong);
}

/* Focus state */
.input:focus {
  outline: var(--focus-ring-width) solid var(--color-focus-ring);
  outline-offset: var(--focus-ring-offset);
  border-color: var(--color-primary);
}

/* Error state */
.input--error {
  border-color: var(--color-danger-outline);
}

.input--error:focus {
  outline-color: var(--color-danger);
}

/* Disabled state */
.input:disabled {
  background-color: var(--color-disabled-bg);
  color: var(--color-disabled-text);
  border-color: var(--color-disabled-border);
  cursor: not-allowed;
}

.label {
  display: block;
  margin-bottom: var(--spacing-2);
  
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.error {
  display: block;
  margin-top: var(--spacing-2);
  
  font-size: var(--font-size-sm);
  color: var(--color-danger);
}
```

##### Toast Component

```css
/* src/components/ui/Toast/Toast.module.css */

.toast {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-3);
  
  padding: var(--spacing-4);
  
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-normal);
  
  border-radius: var(--radius-lg);
  border: 2px solid transparent;
  
  box-shadow: var(--shadow-lg);
  
  animation: slideIn var(--transition-base);
}

@keyframes slideIn {
  from {
    transform: translateY(-100%);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Success variant */
.toast--success {
  background-color: var(--color-success);
  color: var(--color-on-success);
  border-color: var(--color-success-outline);
}

/* Error variant */
.toast--error {
  background-color: var(--color-danger);
  color: var(--color-on-danger);
  border-color: var(--color-danger-outline);
}

/* Info variant */
.toast--info {
  background-color: var(--color-info);
  color: var(--color-on-info);
  border-color: var(--color-info-outline);
}

/* Warning variant */
.toast--warning {
  background-color: var(--color-warning);
  color: var(--color-on-warning);
  border-color: var(--color-warning-outline);
}

.close {
  background: transparent;
  border: none;
  color: inherit;
  font-size: var(--font-size-2xl);
  line-height: 1;
  cursor: pointer;
  padding: 0;
  
  /* Touch target */
  min-width: var(--touch-target-min);
  min-height: var(--touch-target-min);
  
  display: flex;
  align-items: center;
  justify-content: center;
}

.close:hover {
  opacity: 0.8;
}

.close:focus-visible {
  outline: var(--focus-ring-width) solid currentColor;
  outline-offset: var(--focus-ring-offset);
  border-radius: var(--radius-sm);
}
```

#### デザイントークン使用のベストプラクティス

1. **直接的な色指定を避ける**: `#1E6BFF` ではなく `var(--color-primary)` を使用
2. **on-colorルールを遵守**: 背景色に対応する文字色は必ず `--color-on-{name}` を使用
3. **境界線の使い分け**: 
   - 薄い境界線: `var(--color-border-subtle)`
   - 濃い境界線: `var(--color-border-strong)`
   - 入力フィールド: `var(--color-border-input)`
4. **状態の明示**: Disabled、Focus、Hover状態では専用のトークンを使用
5. **スペーシングの一貫性**: すべてのスペーシングは4pxの倍数（`var(--spacing-*)` を使用）
6. **タッチターゲット**: インタラクティブ要素は最低 `var(--touch-target-min)` (44px) を確保

### Dark Theme Support

Dark themeは `[data-theme="dark"]` セレクタで自動的に適用されます。上記のデザイントークン定義により、すべてのコンポーネントが自動的にダークモードに対応します。

### UI Component Library

#### Button Component

```typescript
// src/components/ui/Button/Button.tsx
import styles from './Button.module.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`${styles.button} ${styles[`button--${variant}`]} ${styles[`button--${size}`]} ${fullWidth ? styles['button--full'] : ''} ${className || ''}`}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      <span className={loading ? styles.content--loading : ''}>{children}</span>
    </button>
  );
}
```

#### Card Component

```typescript
// src/components/ui/Card/Card.tsx
import styles from './Card.module.css';

export interface CardProps {
  header?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  elevated?: boolean;
  className?: string;
}

export function Card({ header, children, footer, elevated = false, className }: CardProps) {
  return (
    <div className={`${styles.card} ${elevated ? styles['card--elevated'] : ''} ${className || ''}`}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
```

#### Badge Component

```typescript
// src/components/ui/Badge/Badge.tsx
import styles from './Badge.module.css';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', size = 'md' }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[`badge--${variant}`]} ${styles[`badge--${size}`]}`}>
      {children}
    </span>
  );
}
```

#### Modal Component

```typescript
// src/components/ui/Modal/Modal.tsx
import { useEffect, useRef } from 'react';
import styles from './Modal.module.css';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        ref={dialogRef}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className={styles.header}>
            <h2 id="modal-title" className={styles.title}>{title}</h2>
            <button
              type="button"
              className={styles.close}
              onClick={onClose}
              aria-label="Close modal"
            >
              ×
            </button>
          </div>
        )}
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}
```

#### Toast Component

```typescript
// src/components/ui/Toast/Toast.tsx
import { useEffect } from 'react';
import styles from './Toast.module.css';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div className={`${styles.toast} ${styles[`toast--${type}`]}`} role="alert">
      <span>{message}</span>
      <button
        type="button"
        className={styles.close}
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}
```

#### Spinner Component

```typescript
// src/components/ui/Spinner/Spinner.tsx
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading...' }: SpinnerProps) {
  return (
    <div className={styles.container} role="status" aria-label={label}>
      <div className={`${styles.spinner} ${styles[`spinner--${size}`]}`} />
      <span className={styles.label}>{label}</span>
    </div>
  );
}
```

### Theme Management

#### useTheme Hook

```typescript
// src/hooks/useTheme.ts
import { useEffect, useState } from 'react';
import { getTheme, setTheme, type Theme } from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme === 'auto' ? getSystemTheme() : theme);
  }, [theme]);

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    setThemeState(newTheme);
  };

  return { theme, setTheme: updateTheme };
}

function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
```

## エラーハンドリング

### Theme Loading Errors

```typescript
// Graceful fallback when localStorage is unavailable
export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  return 'auto'; // Default fallback
}

export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error);
  }
}
```

### CSS Module Loading Errors

CSS Modulesのロード失敗時は、Viteのビルドエラーとして検出されます。開発時は即座にエラーが表示され、プロダクションビルドは失敗します。ランタイムでのフォールバックは不要です。

### Component Prop Validation

TypeScriptの型システムにより、コンパイル時にpropsの型エラーが検出されます。ランタイムバリデーションは以下の場合のみ実装します:

- ユーザー入力値（Input componentのvalidation）
- 外部APIからのデータ（該当なし）
- 動的に生成される値（該当なし）

### Accessibility Errors

アクセシビリティ違反は開発時にReact DevToolsやaxe DevToolsで検出します。プロダクションでは、以下のフォールバックを実装します:

- ARIA属性の欠落: コンポーネントは最低限のARIA属性を自動生成
- フォーカス管理の失敗: Modalコンポーネントはフォーカストラップ失敗時にコンソール警告を出力
- キーボードナビゲーション: すべてのインタラクティブ要素はネイティブHTML要素を使用し、ブラウザのデフォルト動作に依存

## テスト戦略

### Unit Tests

ユニットテストは具体的な例、エッジケース、エラー条件を検証します。

**対象:**
- UIコンポーネントのレンダリング（Button, Input, Card, Badge, Modal, Toast, Spinner）
- Theme utilities（getTheme, setTheme, getSystemTheme, getEffectiveTheme）
- useTheme hook

**テストケース例:**

```typescript
// tests/unit/button.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button/Button';

describe('Button component', () => {
  it('renders with primary variant by default', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('button--primary');
  });

  it('displays spinner when loading', () => {
    render(<Button loading>Submit</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();
  });

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });
});
```

### Property-Based Tests

プロパティベーステストは、すべての入力に対して成り立つ普遍的な性質を検証します。fast-checkライブラリを使用し、各テストは最低100回実行します。

**対象:**
- Spacing scale consistency (4px base unit)
- Button variant rendering
- Input label association
- Theme persistence round-trip
- Color contrast ratios

**テストケース例:**

```typescript
// tests/property/spacing-scale.property.test.ts
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

describe('Feature: mobile-first-design, Property 2: Spacing scale consistency', () => {
  it('all spacing values are multiples of 4px', () => {
    const spacingValues = [4, 8, 12, 16, 20, 24, 32, 40, 48]; // from design system
    
    fc.assert(
      fc.property(fc.constantFrom(...spacingValues), (spacing) => {
        expect(spacing % 4).toBe(0);
      }),
      { numRuns: 100 }
    );
  });
});

// tests/property/theme-persistence.property.test.ts
describe('Feature: mobile-first-design, Property 13: Theme persistence', () => {
  it('theme round-trip preserves value', () => {
    fc.assert(
      fc.property(fc.constantFrom('light', 'dark', 'auto'), (theme) => {
        setTheme(theme);
        const retrieved = getTheme();
        expect(retrieved).toBe(theme);
      }),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

統合テストは、複数のコンポーネントが連携して動作することを検証します。

**対象:**
- Theme switching across multiple components
- Form validation with Input and Button components
- Modal focus management
- Toast notification lifecycle

### Visual Regression Tests (Optional)

ビジュアルリグレッションテストは、UIの見た目が意図せず変更されていないことを確認します。PoCフェーズでは優先度低ですが、将来的にPlaywrightやStorybookで実装可能です。

### Accessibility Tests

アクセシビリティテストは、WCAG AA準拠を検証します。

**ツール:**
- axe-core (自動テスト)
- React Testing Library (ARIA属性検証)
- 手動テスト (スクリーンリーダー、キーボードナビゲーション)

**テストケース例:**

```typescript
// tests/unit/input-accessibility.test.ts
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from 'jest-axe';
import { Input } from '@/components/ui/Input/Input';

describe('Input accessibility', () => {
  it('associates label with input', () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    expect(input).toBeInTheDocument();
  });

  it('announces error to screen readers', () => {
    render(<Input label="Email" error="Invalid email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Input label="Username" />);
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

### Performance Tests

パフォーマンステストは、CSS bundle size、コンポーネントレンダリング時間、アニメーションフレームレートを測定します。

**測定項目:**
- CSS bundle size < 50KB (minified + gzipped)
- Component first render < 16ms (60fps)
- Theme switching < 100ms

### Test Coverage Goals

- Unit tests: 80%以上のコードカバレッジ
- Property tests: すべての決定論的プロパティ
- Integration tests: 主要なユーザーフロー
- Accessibility tests: すべてのUIコンポーネント

## 実装計画

### Phase 1: Design System Foundation

1. CSS reset and global styles
2. Design system CSS variables (colors, typography, spacing, etc.)
3. Dark theme variables
4. Responsive breakpoints

### Phase 2: Core UI Components

1. Button component
2. Input component
3. Card component
4. Badge component
5. Spinner component

### Phase 3: Advanced UI Components

1. Modal component
2. Toast component
3. Theme switcher component

### Phase 4: Theme Management

1. Theme utilities (getTheme, setTheme)
2. useTheme hook
3. System preference detection
4. localStorage persistence

### Phase 5: Component Refactoring

1. Refactor CowListScreen
2. Refactor CowDetailView
3. Refactor CowRegistrationForm
4. Refactor VoiceRecorder
5. Refactor VisitEditor
6. Refactor other existing components

### Phase 6: Accessibility & Polish

1. ARIA attributes audit
2. Keyboard navigation testing
3. Screen reader testing
4. Color contrast verification
5. Animation and transition polish

### Phase 7: Testing & Documentation

1. Unit tests for all UI components
2. Property-based tests
3. Accessibility tests
4. Component documentation (Storybook or similar)

## パフォーマンス最適化

### CSS Optimization

- **Tree-shaking**: Vite automatically removes unused CSS from CSS Modules
- **Minification**: Production builds minify CSS with cssnano
- **Critical CSS**: Inline critical CSS in HTML head (future optimization)
- **Code splitting**: Lazy load heavy components (QRScanner, VoiceRecorder)

### Font Loading

- **System fonts**: Use system font stack to avoid external font loading
- **Font display**: If custom fonts are added, use `font-display: swap`

### Image Optimization

- **Responsive images**: Use `srcset` and `sizes` attributes
- **Modern formats**: Prefer WebP/AVIF with fallbacks
- **Lazy loading**: Use `loading="lazy"` for below-fold images

### Component Lazy Loading

```typescript
// Lazy load heavy components
const QRScanner = lazy(() => import('./components/QRScanner'));
const VoiceRecorder = lazy(() => import('./components/VoiceRecorder'));

// Wrap in Suspense
<Suspense fallback={<Spinner />}>
  <QRScanner />
</Suspense>
```

### Animation Performance

- **CSS transforms**: Use `transform` and `opacity` for animations (GPU-accelerated)
- **will-change**: Use sparingly for frequently animated elements
- **Reduced motion**: Respect `prefers-reduced-motion` media query

## セキュリティ考慮事項

### XSS Prevention

- React automatically escapes content in JSX
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Sanitize user input before rendering

### CSS Injection

- CSS Modules provide automatic scoping, preventing CSS injection
- Avoid inline styles with user-provided values

### localStorage Security

- Theme preference is not sensitive data
- No authentication tokens or PII stored in localStorage (handled by Amplify)

## 今後の拡張性

### Component Library Growth

新しいUIコンポーネントを追加する際のガイドライン:

1. `src/components/ui/` に新しいディレクトリを作成
2. TypeScript + CSS Modulesで実装
3. Design system CSS variablesを使用
4. ARIA attributes を適切に設定
5. Unit tests + property tests を作成
6. Storybook story を追加（将来）

### Design Token Evolution

デザイントークンを変更する際のガイドライン:

1. `src/styles/design-system.css` を更新
2. 既存コンポーネントへの影響を確認
3. Visual regression tests を実行（将来）
4. ドキュメントを更新

### Theme Variants

追加のテーマバリアント（例: high-contrast, colorblind-friendly）を実装する際:

1. 新しい `[data-theme="variant"]` セレクタを追加
2. Theme type を拡張
3. Theme switcher UIを更新
4. Color contrast tests を追加

### Internationalization (i18n)

将来的に多言語対応する際の考慮事項:

- UI component labels は props で受け取る（ハードコードしない）
- RTL (right-to-left) レイアウト対応のためのCSS logical properties使用
- Font stack に多言語フォントを追加

## 参考資料

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [MDN: CSS Custom Properties](https://developer.mozilla.org/en-US/docs/Web/CSS/--*)
- [MDN: CSS Modules](https://github.com/css-modules/css-modules)
- [React: Accessibility](https://react.dev/learn/accessibility)
- [Material Design: Touch Targets](https://m2.material.io/design/usability/accessibility.html#layout-and-typography)
- [Apple Human Interface Guidelines: Touch Targets](https://developer.apple.com/design/human-interface-guidelines/inputs/touchscreen-gestures)
