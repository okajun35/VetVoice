/**
 * Feature: ui-consistency-fix
 * Property 2: Preservation — new UI primitives render correctly for any props combination
 *
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12
 *
 * These tests establish a baseline BEFORE screen refactoring.
 * They must PASS after primitives are created (task 3) and continue to PASS after
 * screen refactoring (tasks 4-8), confirming no regression was introduced.
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render } from '@testing-library/react';
import React from 'react';
import { Select } from '../../src/components/ui/Select/Select';
import { Textarea } from '../../src/components/ui/Textarea/Textarea';
import { Tabs } from '../../src/components/ui/Tabs/Tabs';
import { Alert } from '../../src/components/ui/Alert/Alert';
import type { SelectOption } from '../../src/components/ui/Select/Select';
import type { TabItem } from '../../src/components/ui/Tabs/Tabs';
import type { AlertVariant } from '../../src/components/ui/Alert/Alert';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

const labelArb = fc.option(fc.string({ minLength: 1, maxLength: 40 }), { nil: undefined });
const errorArb = fc.option(fc.string({ minLength: 1, maxLength: 80 }), { nil: undefined });
const booleanArb = fc.boolean();

/** Non-empty array of SelectOption with unique values */
const selectOptionsArb: fc.Arbitrary<SelectOption[]> = fc
  .array(
    fc.record({
      value: fc.string({ minLength: 1, maxLength: 20 }),
      label: fc.string({ minLength: 1, maxLength: 40 }),
    }),
    { minLength: 1, maxLength: 10 }
  )
  .map((opts) => {
    const seen = new Set<string>();
    return opts.filter((o) => {
      if (seen.has(o.value)) return false;
      seen.add(o.value);
      return true;
    });
  })
  .filter((opts) => opts.length > 0);

/** Non-empty array of TabItem with unique values */
const tabItemsArb: fc.Arbitrary<TabItem[]> = fc
  .array(
    fc.record({
      value: fc.string({ minLength: 1, maxLength: 20 }),
      label: fc.string({ minLength: 1, maxLength: 40 }),
    }),
    { minLength: 1, maxLength: 8 }
  )
  .map((tabs) => {
    const seen = new Set<string>();
    return tabs.filter((t) => {
      if (seen.has(t.value)) return false;
      seen.add(t.value);
      return true;
    });
  })
  .filter((tabs) => tabs.length > 0);

const alertVariantArb = fc.constantFrom<AlertVariant>(
  'success',
  'warning',
  'error',
  'info'
);

const childrenArb = fc.string({ minLength: 1, maxLength: 80 });

// ---------------------------------------------------------------------------
// Select property tests
// ---------------------------------------------------------------------------

describe('Feature: ui-consistency-fix, Property 2: Select primitive', () => {
  it('renders with any label, error, disabled combination and applies correct classes', () => {
    fc.assert(
      fc.property(
        labelArb,
        errorArb,
        booleanArb,
        selectOptionsArb,
        (label, error, disabled, options) => {
          const { container } = render(
            React.createElement(Select, { label, error, disabled, options })
          );

          const select = container.querySelector('select');
          expect(select).not.toBeNull();
          if (!select) return false;

          // Base class must always be present
          expect(select.className).toContain('select');

          // Error class applied when error prop is set
          if (error) {
            expect(select.className).toContain('select--error');
            expect(select.getAttribute('aria-invalid')).toBe('true');
          } else {
            expect(select.className).not.toContain('select--error');
            expect(select.getAttribute('aria-invalid')).toBeNull();
          }

          // Disabled state propagated to native element
          expect(select.disabled).toBe(disabled);

          // Label rendered when provided
          if (label) {
            const labelEl = container.querySelector('label');
            expect(labelEl).not.toBeNull();
            expect(labelEl?.textContent).toBe(label);
          }

          // All options rendered
          const optionEls = container.querySelectorAll('option');
          expect(optionEls.length).toBe(options.length);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shows error message with role="alert" when error prop is set', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        selectOptionsArb,
        (error, options) => {
          const { container } = render(
            React.createElement(Select, { error, options })
          );

          const errorEl = container.querySelector('[role="alert"]');
          expect(errorEl).not.toBeNull();
          expect(errorEl?.textContent).toBe(error);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Textarea property tests
// ---------------------------------------------------------------------------

describe('Feature: ui-consistency-fix, Property 2: Textarea primitive', () => {
  it('renders with any label, error, rows combination and applies correct classes', () => {
    fc.assert(
      fc.property(
        labelArb,
        errorArb,
        fc.option(fc.integer({ min: 1, max: 20 }), { nil: undefined }),
        (label, error, rows) => {
          const { container } = render(
            React.createElement(Textarea, { label, error, rows })
          );

          const textarea = container.querySelector('textarea');
          expect(textarea).not.toBeNull();
          if (!textarea) return false;

          // Base class must always be present
          expect(textarea.className).toContain('textarea');

          // Error class applied when error prop is set
          if (error) {
            expect(textarea.className).toContain('textarea--error');
            expect(textarea.getAttribute('aria-invalid')).toBe('true');
          } else {
            expect(textarea.className).not.toContain('textarea--error');
            expect(textarea.getAttribute('aria-invalid')).toBeNull();
          }

          // rows attribute set when provided
          if (rows !== undefined) {
            expect(textarea.rows).toBe(rows);
          }

          // Label rendered when provided
          if (label) {
            const labelEl = container.querySelector('label');
            expect(labelEl).not.toBeNull();
            expect(labelEl?.textContent).toBe(label);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('shows error message with role="alert" when error prop is set', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 80 }),
        (error) => {
          const { container } = render(
            React.createElement(Textarea, { error })
          );

          const errorEl = container.querySelector('[role="alert"]');
          expect(errorEl).not.toBeNull();
          expect(errorEl?.textContent).toBe(error);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });
});

// ---------------------------------------------------------------------------
// Tabs property tests
// ---------------------------------------------------------------------------

describe('Feature: ui-consistency-fix, Property 2: Tabs primitive', () => {
  it('renders role="tablist" and role="tab" for any tabs array', () => {
    fc.assert(
      fc.property(tabItemsArb, (tabs) => {
        const activeTab = tabs[0].value;
        const { container } = render(
          React.createElement(Tabs, {
            tabs,
            activeTab,
            onTabChange: () => {},
          })
        );

        // Container must have role="tablist"
        const tabList = container.querySelector('[role="tablist"]');
        expect(tabList).not.toBeNull();

        // Each tab must have role="tab"
        const tabEls = container.querySelectorAll('[role="tab"]');
        expect(tabEls.length).toBe(tabs.length);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('sets aria-selected correctly for any activeTab value', () => {
    fc.assert(
      fc.property(tabItemsArb, fc.integer({ min: 0, max: 7 }), (tabs, indexSeed) => {
        const activeIndex = indexSeed % tabs.length;
        const activeTab = tabs[activeIndex].value;

        const { container } = render(
          React.createElement(Tabs, {
            tabs,
            activeTab,
            onTabChange: () => {},
          })
        );

        const tabEls = container.querySelectorAll('[role="tab"]');
        expect(tabEls.length).toBe(tabs.length);

        tabEls.forEach((tabEl, i) => {
          const isActive = tabs[i].value === activeTab;
          expect(tabEl.getAttribute('aria-selected')).toBe(String(isActive));
        });

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('exactly one tab has aria-selected="true" when activeTab matches a tab value', () => {
    fc.assert(
      fc.property(tabItemsArb, (tabs) => {
        const activeTab = tabs[0].value;
        const { container } = render(
          React.createElement(Tabs, {
            tabs,
            activeTab,
            onTabChange: () => {},
          })
        );

        const selectedTabs = container.querySelectorAll('[aria-selected="true"]');
        expect(selectedTabs.length).toBe(1);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Alert property tests
// ---------------------------------------------------------------------------

describe('Feature: ui-consistency-fix, Property 2: Alert primitive', () => {
  it('renders role="alert" and correct variant class for any variant', () => {
    fc.assert(
      fc.property(alertVariantArb, childrenArb, (variant, children) => {
        const { container } = render(
          React.createElement(Alert, { variant, children })
        );

        const alertEl = container.querySelector('[role="alert"]');
        expect(alertEl).not.toBeNull();
        if (!alertEl) return false;

        // Base class must be present
        expect(alertEl.className).toContain('alert');

        // Variant class must be present
        expect(alertEl.className).toContain(`alert--${variant}`);

        // Children must be rendered
        expect(alertEl.textContent).toContain(children);

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('has exactly one variant class for any variant', () => {
    fc.assert(
      fc.property(alertVariantArb, childrenArb, (variant, children) => {
        const { container } = render(
          React.createElement(Alert, { variant, children })
        );

        const alertEl = container.querySelector('[role="alert"]');
        if (!alertEl) return false;

        const variantClasses = ['alert--error', 'alert--warning', 'alert--success', 'alert--info'];
        const presentClasses = variantClasses.filter((cls) =>
          alertEl.className.includes(cls)
        );

        expect(presentClasses.length).toBe(1);
        expect(presentClasses[0]).toBe(`alert--${variant}`);

        return true;
      }),
      { numRuns: 100 }
    );
  });
});
