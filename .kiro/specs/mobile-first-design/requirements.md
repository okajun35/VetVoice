# Requirements Document

## Introduction

VetVoiceは牛舎・農場での利用を想定したモバイルファーストの獣医診療記録システムです。現在、基本的なインラインスタイルのみで実装されており、モバイル端末での使いやすさ、視認性、操作性に課題があります。本機能では、モバイルファーストのデザインシステムを導入し、タッチ操作に最適化されたUIコンポーネント、レスポンシブレイアウト、アクセシビリティ対応を実現します。

## Glossary

- **Design_System**: 色、タイポグラフィ、スペーシング、コンポーネントスタイルを統一的に定義したデザイン規則
- **Touch_Target**: タッチ操作可能な領域（ボタン、リンク等）のサイズ。最小44x44pxが推奨
- **Viewport**: ブラウザの表示領域。モバイル端末では幅320px〜428px程度
- **Responsive_Layout**: 画面サイズに応じて最適なレイアウトに変化するデザイン
- **CSS_Module**: コンポーネント単位でスコープされたCSSファイル（`.module.css`）
- **Theme**: ダークモード・ライトモードなどの配色テーマ
- **Accessibility**: 視覚障害者、運動障害者等が利用可能なUI設計（WCAG準拠）

## Requirements

### Requirement 1: デザインシステムの定義

**User Story:** As a developer, I want a unified design system, so that all components have consistent styling and maintainability improves.

#### Acceptance Criteria

1. THE Design_System SHALL define a color palette with primary, secondary, success, warning, error, and neutral colors
2. THE Design_System SHALL define typography scale with font sizes, weights, and line heights for mobile readability
3. THE Design_System SHALL define spacing scale (4px base unit) for consistent margins and paddings
4. THE Design_System SHALL define border radius values for buttons, cards, and input fields
5. THE Design_System SHALL define shadow levels for elevation (none, sm, md, lg)
6. THE Design_System SHALL support light and dark themes with CSS custom properties
7. THE Design_System SHALL be defined in a single CSS file (`src/styles/design-system.css`)

### Requirement 2: モバイルファーストのレスポンシブレイアウト

**User Story:** As a veterinarian, I want the app to work well on my smartphone, so that I can use it in the field without difficulty.

#### Acceptance Criteria

1. WHEN the Viewport width is less than 640px, THE Layout SHALL display single-column layout
2. WHEN the Viewport width is 640px or greater, THE Layout SHALL display multi-column layout where appropriate
3. THE Layout SHALL use CSS Grid or Flexbox for responsive layouts
4. THE Layout SHALL set `viewport` meta tag with `width=device-width, initial-scale=1`
5. THE Layout SHALL avoid horizontal scrolling on mobile devices
6. THE Layout SHALL use relative units (rem, em, %) instead of fixed pixel values where appropriate

### Requirement 3: タッチ操作に最適化されたUIコンポーネント

**User Story:** As a veterinarian, I want buttons and interactive elements to be easy to tap, so that I can operate the app with gloves or in outdoor conditions.

#### Acceptance Criteria

1. THE Touch_Target SHALL have a minimum size of 44x44px for all interactive elements
2. THE Touch_Target SHALL have at least 8px spacing between adjacent interactive elements
3. WHEN a button is in a loading state, THE Button SHALL display a loading indicator and be disabled
4. WHEN a button is disabled, THE Button SHALL have reduced opacity and not respond to clicks
5. THE Input_Field SHALL have a minimum height of 44px for easy tapping
6. THE Input_Field SHALL display appropriate keyboard types on mobile (numeric, email, tel, etc.)
7. THE Checkbox and Radio buttons SHALL have enlarged touch targets (minimum 44x44px including label)

### Requirement 4: CSS Modulesによるコンポーネントスタイリング

**User Story:** As a developer, I want component-scoped CSS, so that styles don't conflict and components are reusable.

#### Acceptance Criteria

1. THE Component SHALL use CSS_Module files (`.module.css`) for component-specific styles
2. THE CSS_Module SHALL import design system variables from `design-system.css`
3. THE Component SHALL not use inline styles except for dynamic values (e.g., conditional colors)
4. THE Component SHALL use semantic class names (e.g., `.button--primary`, `.card--elevated`)
5. THE CSS_Module SHALL be co-located with the component file (e.g., `Button.tsx` and `Button.module.css`)

### Requirement 5: 共通UIコンポーネントライブラリ

**User Story:** As a developer, I want reusable UI components, so that I can build consistent interfaces quickly.

#### Acceptance Criteria

1. THE Component_Library SHALL provide a Button component with variants (primary, secondary, danger, ghost)
2. THE Component_Library SHALL provide a Card component with optional header, body, and footer sections
3. THE Component_Library SHALL provide an Input component with label, error message, and helper text
4. THE Component_Library SHALL provide a Badge component for status indicators
5. THE Component_Library SHALL provide a Spinner component for loading states
6. THE Component_Library SHALL provide a Modal component with overlay and close button
7. THE Component_Library SHALL provide a Toast component for notifications
8. THE Component SHALL be defined in `src/components/ui/` directory

### Requirement 6: アクセシビリティ対応

**User Story:** As a user with visual impairment, I want the app to be accessible with screen readers, so that I can use the app independently.

#### Acceptance Criteria

1. THE Interactive_Element SHALL have appropriate ARIA labels and roles
2. THE Form_Field SHALL associate labels with inputs using `htmlFor` and `id` attributes
3. THE Error_Message SHALL be announced to screen readers using `role="alert"` or `aria-live="polite"`
4. THE Modal SHALL trap focus within the modal when open
5. THE Modal SHALL return focus to the trigger element when closed
6. THE Color_Contrast SHALL meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)
7. THE Interactive_Element SHALL be keyboard navigable (Tab, Enter, Space, Escape)

### Requirement 7: 既存コンポーネントのリファクタリング

**User Story:** As a developer, I want existing components to use the new design system, so that the entire app has a consistent look and feel.

#### Acceptance Criteria

1. WHEN an existing component is refactored, THE Component SHALL replace inline styles with CSS_Module classes
2. WHEN an existing component uses buttons, THE Component SHALL use the Button component from the library
3. WHEN an existing component uses form inputs, THE Component SHALL use the Input component from the library
4. WHEN an existing component displays status, THE Component SHALL use the Badge component from the library
5. THE Refactored_Component SHALL maintain the same functionality as before
6. THE Refactored_Component SHALL pass all existing tests without modification

### Requirement 8: ダークモード対応

**User Story:** As a veterinarian working at night, I want a dark mode option, so that the screen is less bright and easier on my eyes.

#### Acceptance Criteria

1. THE Theme_Switcher SHALL detect system preference using `prefers-color-scheme` media query
2. THE Theme_Switcher SHALL allow manual theme selection (light, dark, auto)
3. THE Theme_Switcher SHALL persist theme preference in localStorage
4. WHEN the theme changes, THE Design_System SHALL apply the corresponding color palette using CSS custom properties
5. THE Component SHALL not require code changes to support dark mode (CSS variables handle color switching)

### Requirement 9: パフォーマンス最適化

**User Story:** As a veterinarian with limited mobile data, I want the app to load quickly, so that I can start recording visits without delay.

#### Acceptance Criteria

1. THE CSS_Bundle SHALL be minified in production builds
2. THE CSS_Module SHALL use tree-shaking to remove unused styles
3. THE Design_System SHALL avoid loading unnecessary fonts or icon libraries
4. THE Component SHALL use lazy loading for heavy components (e.g., QR scanner, voice recorder)
5. THE Image SHALL use appropriate formats (WebP, AVIF) and responsive sizes

### Requirement 10: タッチジェスチャー対応

**User Story:** As a veterinarian, I want to use swipe gestures to navigate, so that I can operate the app with one hand.

#### Acceptance Criteria

1. WHERE swipe gestures are enabled, WHEN the user swipes right on a detail view, THE App SHALL navigate back to the previous screen
2. WHERE swipe gestures are enabled, WHEN the user swipes left on a list item, THE App SHALL reveal action buttons (edit, delete)
3. THE Swipe_Gesture SHALL have a minimum swipe distance of 50px to trigger
4. THE Swipe_Gesture SHALL provide visual feedback during the swipe (e.g., item translation)
5. THE Swipe_Gesture SHALL not interfere with horizontal scrolling in tables or carousels

### Requirement 11: オフライン時のUI状態表示

**User Story:** As a veterinarian in areas with poor connectivity, I want to see when the app is offline, so that I know my data will be synced later.

#### Acceptance Criteria

1. WHEN the device is offline, THE Status_Indicator SHALL display an offline badge in the header
2. WHEN the device reconnects, THE Status_Indicator SHALL display a success message and hide after 3 seconds
3. WHEN data is queued for sync, THE Status_Indicator SHALL show the number of pending items
4. THE Offline_UI SHALL disable features that require network connectivity (e.g., AI pipeline)
5. THE Offline_UI SHALL allow viewing and editing cached data

### Requirement 12: ローディング状態とスケルトンスクリーン

**User Story:** As a user, I want to see loading indicators, so that I know the app is working and not frozen.

#### Acceptance Criteria

1. WHEN data is loading, THE Component SHALL display a Spinner or skeleton screen
2. THE Skeleton_Screen SHALL match the layout of the loaded content (e.g., card shapes, text lines)
3. THE Skeleton_Screen SHALL animate with a shimmer effect to indicate loading
4. WHEN an error occurs during loading, THE Component SHALL display an error message with a retry button
5. THE Loading_State SHALL have a timeout of 30 seconds, after which an error message is shown

### Requirement 13: フォームバリデーションとエラー表示

**User Story:** As a veterinarian, I want clear error messages when I make input mistakes, so that I can correct them quickly.

#### Acceptance Criteria

1. WHEN a form field has an error, THE Input_Field SHALL display a red border and error message below
2. WHEN a form field is valid, THE Input_Field SHALL display a green border (optional)
3. THE Error_Message SHALL be specific and actionable (e.g., "体温は30〜45°Cの範囲で入力してください")
4. THE Form SHALL prevent submission when validation errors exist
5. THE Form SHALL focus on the first invalid field when submission is attempted
6. THE Error_Message SHALL be announced to screen readers using `aria-describedby`

### Requirement 14: アニメーションとトランジション

**User Story:** As a user, I want smooth transitions between screens, so that the app feels polished and responsive.

#### Acceptance Criteria

1. THE Transition SHALL use CSS transitions for state changes (hover, focus, active)
2. THE Transition SHALL have a duration of 150-300ms for UI feedback
3. THE Animation SHALL respect `prefers-reduced-motion` media query for accessibility
4. WHEN a modal opens, THE Modal SHALL fade in with a backdrop animation
5. WHEN a toast appears, THE Toast SHALL slide in from the top or bottom
6. THE Animation SHALL not block user interaction or delay critical actions
