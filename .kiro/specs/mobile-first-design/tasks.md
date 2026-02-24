# Implementation Plan: モバイルファーストデザイン改善

## Overview

VetVoiceのモバイルファーストデザインシステムを実装します。統一されたデザイントークン、タッチ最適化されたUIコンポーネントライブラリ、CSS Modules、ダークモード対応、アクセシビリティ対応を段階的に実装します。

## Tasks

- [x] 1. Phase 1: Design System Foundation
  - [x] 1.1 Create CSS reset and global styles
    - Create `src/styles/reset.css` with modern CSS reset
    - Create `src/styles/global.css` with base HTML styles
    - Set viewport meta tag in `index.html`
    - _Requirements: 2.4, 6.2_
  
  - [x] 1.2 Create design system CSS variables
    - Create `src/styles/design-system.css` with all design tokens
    - Define color palette (primary, semantic colors, state colors, borders)
    - Define typography scale (font sizes, weights, line heights)
    - Define spacing scale (4px base unit)
    - Define border radius, shadows, transitions, z-index
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.7_
  
  - [x] 1.3 Add dark theme CSS variables
    - Define `[data-theme="dark"]` selector with dark theme tokens
    - Ensure proper color contrast for dark theme
    - _Requirements: 1.6, 8.4_
  
  - [x] 1.4 Import design system in main entry point
    - Import design system CSS in `src/main.tsx` or `src/App.tsx`
    - Verify CSS variables are available globally
    - _Requirements: 1.7_

- [ ] 2. Phase 2: Core UI Components - Button
  - [x] 2.1 Implement Button component
    - Create `src/components/ui/Button/Button.tsx` with TypeScript interface
    - Support variants: primary, secondary, danger, ghost
    - Support sizes: sm, md, lg
    - Support loading state with spinner
    - Support disabled state
    - Support fullWidth prop
    - Ensure minimum 44x44px touch target
    - _Requirements: 3.1, 3.3, 3.4, 4.1, 4.5, 5.1_
  
  - [x] 2.2 Create Button CSS Module
    - Create `src/components/ui/Button/Button.module.css`
    - Use design system CSS variables
    - Implement hover, active, focus, disabled states
    - Add focus ring with proper offset
    - _Requirements: 4.1, 4.2, 4.4, 6.7, 14.1_
  
  - [x] 2.3 Write unit tests for Button component
    - Test rendering with different variants
    - Test loading state displays spinner and disables button
    - Test disabled state
    - Test fullWidth prop
    - _Requirements: 3.3, 3.4, 5.1_
  
  - [x] 2.4 Write property test for Button component
    - **Property 3: Button variant rendering**
    - **Validates: Requirements 5.1**

- [ ] 3. Phase 2: Core UI Components - Input
  - [x] 3.1 Implement Input component
    - Create `src/components/ui/Input/Input.tsx` with TypeScript interface
    - Support label, error message, helper text
    - Support different input types (text, email, tel, number)
    - Ensure minimum 44px height for touch target
    - Associate label with input using htmlFor and id
    - _Requirements: 3.5, 3.6, 4.5, 5.3, 6.2, 13.1_
  
  - [x] 3.2 Create Input CSS Module
    - Create `src/components/ui/Input/Input.module.css`
    - Use design system CSS variables
    - Implement hover, focus, error, disabled states
    - Style label, error message, helper text
    - _Requirements: 4.1, 4.2, 4.4, 13.1, 13.6_
  
  - [x] 3.3 Write unit tests for Input component
    - Test label association with input
    - Test error state displays error message
    - Test disabled state
    - Test different input types
    - _Requirements: 6.2, 13.1, 13.6_
  
  - [x] 3.4 Write property test for Input component
    - **Property 4: Input label association**
    - **Validates: Requirements 6.2**

- [x] 4. Phase 2: Core UI Components - Card, Badge, Spinner
  - [x] 4.1 Implement Card component
    - Create `src/components/ui/Card/Card.tsx` with TypeScript interface
    - Support optional header, body, footer sections
    - Support elevated prop for shadow
    - _Requirements: 4.5, 5.2_
  
  - [x] 4.2 Create Card CSS Module
    - Create `src/components/ui/Card/Card.module.css`
    - Use design system CSS variables for background, border, shadow
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 4.3 Implement Badge component
    - Create `src/components/ui/Badge/Badge.tsx` with TypeScript interface
    - Support variants: success, warning, error, info, neutral
    - Support sizes: sm, md
    - _Requirements: 4.5, 5.4_
  
  - [x] 4.4 Create Badge CSS Module
    - Create `src/components/ui/Badge/Badge.module.css`
    - Use design system CSS variables for semantic colors
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [x] 4.5 Implement Spinner component
    - Create `src/components/ui/Spinner/Spinner.tsx` with TypeScript interface
    - Support sizes: sm, md, lg
    - Add aria-label for accessibility
    - _Requirements: 4.5, 5.5, 6.1_
  
  - [x] 4.6 Create Spinner CSS Module
    - Create `src/components/ui/Spinner/Spinner.module.css`
    - Use CSS animation for spinning effect
    - Respect prefers-reduced-motion
    - _Requirements: 4.1, 4.2, 14.3_
  
  - [x] 4.7 Write unit tests for Card, Badge, Spinner
    - Test Card with header, body, footer
    - Test Badge variants
    - Test Spinner sizes and aria-label
    - _Requirements: 5.2, 5.4, 5.5, 6.1_

- [x] 5. Checkpoint - Core components complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Phase 3: Advanced UI Components - Modal
  - [x] 6.1 Implement Modal component
    - Create `src/components/ui/Modal/Modal.tsx` with TypeScript interface
    - Support open/close state
    - Support optional title, footer
    - Implement overlay with click-to-close
    - Implement Escape key to close
    - Trap focus within modal when open
    - Return focus to trigger element when closed
    - _Requirements: 4.5, 5.6, 6.4, 6.5, 6.7_
  
  - [x] 6.2 Create Modal CSS Module
    - Create `src/components/ui/Modal/Modal.module.css`
    - Style overlay with backdrop
    - Style modal with shadow and border radius
    - Add fade-in animation
    - Use z-index tokens for proper layering
    - _Requirements: 4.1, 4.2, 14.1, 14.4_
  
  - [x] 6.3 Write unit tests for Modal component
    - Test modal opens and closes
    - Test Escape key closes modal
    - Test overlay click closes modal
    - Test focus trap
    - _Requirements: 6.4, 6.5, 6.7_
  
  - [x] 6.4 Write accessibility tests for Modal
    - Test modal has role="dialog" and aria-modal="true"
    - Test focus management
    - _Requirements: 6.1, 6.4, 6.5_

- [x] 7. Phase 3: Advanced UI Components - Toast
  - [x] 7.1 Implement Toast component
    - Create `src/components/ui/Toast/Toast.tsx` with TypeScript interface
    - Support types: success, error, info, warning
    - Support auto-dismiss with configurable duration
    - Support manual close button
    - Add role="alert" for screen reader announcement
    - _Requirements: 4.5, 5.7, 6.3_
  
  - [x] 7.2 Create Toast CSS Module
    - Create `src/components/ui/Toast/Toast.module.css`
    - Use semantic color tokens
    - Add slide-in animation
    - Use z-index token for proper layering
    - _Requirements: 4.1, 4.2, 14.1, 14.5_
  
  - [x] 7.3 Write unit tests for Toast component
    - Test toast auto-dismisses after duration
    - Test manual close button
    - Test different types
    - _Requirements: 5.7, 6.3_

- [ ] 8. Phase 4: Theme Management
  - [ ] 8.1 Implement theme utilities
    - Create `src/lib/theme.ts` with Theme type
    - Implement getTheme() with localStorage fallback
    - Implement setTheme() with localStorage persistence
    - Implement getSystemTheme() using prefers-color-scheme
    - Implement getEffectiveTheme() for auto mode
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 8.2 Implement useTheme hook
    - Create `src/hooks/useTheme.ts`
    - Use theme utilities
    - Apply data-theme attribute to document root
    - _Requirements: 8.2, 8.4_
  
  - [ ] 8.3 Implement ThemeSwitcher component
    - Create `src/components/ThemeSwitcher.tsx`
    - Support light, dark, auto options
    - Use Button component for UI
    - _Requirements: 8.2_
  
  - [ ] 8.4 Write unit tests for theme utilities
    - Test getTheme() returns default when localStorage is empty
    - Test setTheme() persists to localStorage
    - Test getSystemTheme() detects system preference
    - Test getEffectiveTheme() resolves auto mode
    - _Requirements: 8.1, 8.2, 8.3_
  
  - [ ] 8.5 Write property test for theme persistence
    - **Property 13: Theme persistence round-trip**
    - **Validates: Requirements 8.3**

- [ ] 9. Checkpoint - Theme management complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. Phase 5: Component Refactoring - CowListScreen
  - [ ] 10.1 Refactor CowListScreen to use design system
    - Replace inline styles with CSS Module
    - Use Button component for action buttons
    - Use Card component for cow list items
    - Use Badge component for status indicators
    - Maintain existing functionality
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 10.2 Verify CowListScreen tests still pass
    - Run existing tests for CowListScreen
    - Ensure no functionality regression
    - _Requirements: 7.6_

- [ ] 11. Phase 5: Component Refactoring - CowDetailView
  - [ ] 11.1 Refactor CowDetailView to use design system
    - Replace inline styles with CSS Module
    - Use Button component for action buttons
    - Use Card component for detail sections
    - Use Badge component for status indicators
    - Maintain existing functionality
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ] 11.2 Verify CowDetailView tests still pass
    - Run existing tests for CowDetailView
    - Ensure no functionality regression
    - _Requirements: 7.6_

- [ ] 12. Phase 5: Component Refactoring - CowRegistrationForm
  - [ ] 12.1 Refactor CowRegistrationForm to use design system
    - Replace inline styles with CSS Module
    - Use Input component for form fields
    - Use Button component for submit button
    - Use design system spacing and colors
    - Maintain existing functionality
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  
  - [ ] 12.2 Verify CowRegistrationForm tests still pass
    - Run existing tests for CowRegistrationForm
    - Ensure no functionality regression
    - _Requirements: 7.6_

- [ ] 13. Phase 5: Component Refactoring - Other Components
  - [ ] 13.1 Refactor VoiceRecorder to use design system
    - Replace inline styles with CSS Module
    - Use Button component for record/stop buttons
    - Use Spinner component for loading states
    - _Requirements: 7.1, 7.2, 7.5_
  
  - [ ] 13.2 Refactor VisitEditor to use design system
    - Replace inline styles with CSS Module
    - Use Input component for form fields
    - Use Button component for action buttons
    - Use Card component for sections
    - _Requirements: 7.1, 7.2, 7.3, 7.5_
  
  - [ ] 13.3 Refactor QRScanner to use design system
    - Replace inline styles with CSS Module
    - Use Button component for action buttons
    - Use Modal component if applicable
    - _Requirements: 7.1, 7.2, 7.5_

- [ ] 14. Checkpoint - Component refactoring complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Phase 6: Accessibility & Polish
  - [ ] 15.1 Audit ARIA attributes across all components
    - Verify all interactive elements have appropriate ARIA labels
    - Verify form fields have proper associations
    - Verify error messages are announced
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ] 15.2 Test keyboard navigation
    - Verify all interactive elements are keyboard accessible
    - Verify Tab order is logical
    - Verify Enter/Space activate buttons
    - Verify Escape closes modals
    - _Requirements: 6.7_
  
  - [ ] 15.3 Verify color contrast ratios
    - Check all text colors meet WCAG AA standards (4.5:1 for normal, 3:1 for large)
    - Check both light and dark themes
    - _Requirements: 6.6_
  
  - [ ] 15.4 Polish animations and transitions
    - Verify all transitions use appropriate durations (150-300ms)
    - Verify prefers-reduced-motion is respected
    - Verify animations don't block interaction
    - _Requirements: 14.1, 14.2, 14.3, 14.6_

- [ ] 16. Phase 7: Testing & Documentation
  - [ ] 16.1 Write property test for spacing scale consistency
    - **Property 2: Spacing scale consistency**
    - **Validates: Requirements 1.3**
  
  - [ ] 16.2 Write property test for button variant rendering
    - **Property 3: Button variant rendering**
    - **Validates: Requirements 5.1**
  
  - [ ] 16.3 Write property test for input label association
    - **Property 4: Input label association**
    - **Validates: Requirements 6.2**
  
  - [ ] 16.4 Write accessibility tests for all UI components
    - Test Button accessibility (ARIA labels, keyboard navigation)
    - Test Input accessibility (label association, error announcement)
    - Test Modal accessibility (focus trap, role, aria-modal)
    - Test Toast accessibility (role="alert")
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.7_
  
  - [ ] 16.5 Write integration tests
    - Test theme switching across multiple components
    - Test form validation with Input and Button
    - Test Modal focus management
    - Test Toast notification lifecycle
    - _Requirements: 8.4, 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 17. Final checkpoint - All implementation complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All components use TypeScript for type safety
- All components use CSS Modules for scoped styling
- All components use design system CSS variables for consistency
- Refactored components must maintain existing functionality and pass existing tests
