/**
 * Property-based tests: Button component
 * Feature: mobile-first-design
 *
 * Validates correctness properties (Property 3: Button variant rendering) from the design doc
 * using fast-check.
 *
 * **Validates: Requirements 5.1**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render } from '@testing-library/react';
import { Button, type ButtonProps } from '../../src/components/ui/Button/Button';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Arbitrary generator for Button variants
 */
const variantArb = fc.constantFrom(
  'primary' as const,
  'secondary' as const,
  'danger' as const,
  'ghost' as const
);

/**
 * Arbitrary generator for Button sizes
 */
const sizeArb = fc.constantFrom(
  'sm' as const,
  'md' as const,
  'lg' as const
);

/**
 * Arbitrary generator for boolean props
 */
const booleanArb = fc.boolean();

/**
 * Arbitrary generator for Button children (text content)
 */
const childrenArb = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Arbitrary generator for complete ButtonProps
 * (excluding HTML button attributes for simplicity)
 */
const buttonPropsArb: fc.Arbitrary<Omit<ButtonProps, 'children'>> = fc.record({
  variant: fc.option(variantArb, { nil: undefined }),
  size: fc.option(sizeArb, { nil: undefined }),
  loading: fc.option(booleanArb, { nil: undefined }),
  fullWidth: fc.option(booleanArb, { nil: undefined }),
  disabled: fc.option(booleanArb, { nil: undefined }),
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Feature: mobile-first-design — Button property tests', () => {
  /**
   * Feature: mobile-first-design, Property 3: Button variant rendering
   *
   * For any combination of variant, size, loading, fullWidth, and disabled props,
   * the Button component must:
   * 1. Render successfully without errors
   * 2. Apply the correct CSS class for the variant (or default to 'primary')
   * 3. Apply the correct CSS class for the size (or default to 'md')
   * 4. Apply the 'button--full' class when fullWidth is true
   * 5. Be disabled when either disabled or loading is true
   * 6. Have aria-busy="true" when loading is true
   *
   * Validates: Requirements 5.1
   */
  it('Property 3: Button renders correctly with all variant combinations', () => {
    fc.assert(
      fc.property(
        buttonPropsArb,
        childrenArb,
        (props, children) => {
          // Render the button with generated props
          const { container } = render(<Button {...props}>{children}</Button>);
          const button = container.querySelector('button');

          // 1. Button must render
          expect(button).not.toBeNull();
          if (!button) return false;

          // 2. Variant class must be applied (default: primary)
          const expectedVariant = props.variant ?? 'primary';
          expect(button.className).toContain(`button--${expectedVariant}`);

          // 3. Size class must be applied (default: md)
          const expectedSize = props.size ?? 'md';
          expect(button.className).toContain(`button--${expectedSize}`);

          // 4. Full width class must be applied when fullWidth is true
          if (props.fullWidth === true) {
            expect(button.className).toContain('button--full');
          } else {
            expect(button.className).not.toContain('button--full');
          }

          // 5. Button must be disabled when disabled or loading is true
          const shouldBeDisabled = props.disabled === true || props.loading === true;
          expect(button.disabled).toBe(shouldBeDisabled);

          // 6. aria-busy must be set correctly based on loading state
          const expectedAriaBusy = props.loading === true ? 'true' : 'false';
          expect(button.getAttribute('aria-busy')).toBe(expectedAriaBusy);

          // 7. Children must be rendered
          expect(button.textContent).toContain(children);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 3.1: Variant class exclusivity
   *
   * For any Button, exactly one variant class must be present.
   * A Button cannot have multiple variant classes simultaneously.
   *
   * Validates: Requirements 5.1
   */
  it('Property 3.1: Button has exactly one variant class', () => {
    fc.assert(
      fc.property(
        buttonPropsArb,
        childrenArb,
        (props, children) => {
          const { container } = render(<Button {...props}>{children}</Button>);
          const button = container.querySelector('button');

          if (!button) return false;

          const variantClasses = [
            'button--primary',
            'button--secondary',
            'button--danger',
            'button--ghost',
          ];

          // Count how many variant classes are present
          const presentVariantClasses = variantClasses.filter((cls) =>
            button.className.includes(cls)
          );

          // Exactly one variant class must be present
          expect(presentVariantClasses.length).toBe(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 3.2: Size class exclusivity
   *
   * For any Button, exactly one size class must be present.
   * A Button cannot have multiple size classes simultaneously.
   *
   * Validates: Requirements 5.1
   */
  it('Property 3.2: Button has exactly one size class', () => {
    fc.assert(
      fc.property(
        buttonPropsArb,
        childrenArb,
        (props, children) => {
          const { container } = render(<Button {...props}>{children}</Button>);
          const button = container.querySelector('button');

          if (!button) return false;

          const sizeClasses = ['button--sm', 'button--md', 'button--lg'];

          // Count how many size classes are present
          const presentSizeClasses = sizeClasses.filter((cls) =>
            button.className.includes(cls)
          );

          // Exactly one size class must be present
          expect(presentSizeClasses.length).toBe(1);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 3.3: Loading state consistency
   *
   * When loading is true:
   * - Button must be disabled
   * - aria-busy must be "true"
   * - Spinner element must be present
   *
   * Validates: Requirements 5.1, 3.3
   */
  it('Property 3.3: Loading state is consistent', () => {
    fc.assert(
      fc.property(
        variantArb,
        sizeArb,
        booleanArb,
        childrenArb,
        (variant, size, fullWidth, children) => {
          // Always set loading to true for this test
          const { container } = render(
            <Button variant={variant} size={size} fullWidth={fullWidth} loading>
              {children}
            </Button>
          );
          const button = container.querySelector('button');

          if (!button) return false;

          // Button must be disabled
          expect(button.disabled).toBe(true);

          // aria-busy must be "true"
          expect(button.getAttribute('aria-busy')).toBe('true');

          // Spinner SVG must be present
          const spinner = button.querySelector('svg');
          expect(spinner).not.toBeNull();

          // Spinner span with aria-hidden must be present
          const spinnerSpan = button.querySelector('span[aria-hidden="true"]');
          expect(spinnerSpan).not.toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 3.4: Disabled state consistency
   *
   * When disabled is true (and loading is false):
   * - Button must be disabled
   * - aria-busy must be "false"
   * - Spinner element must NOT be present
   *
   * Validates: Requirements 5.1, 3.4
   */
  it('Property 3.4: Disabled state is consistent', () => {
    fc.assert(
      fc.property(
        variantArb,
        sizeArb,
        booleanArb,
        childrenArb,
        (variant, size, fullWidth, children) => {
          // Set disabled to true, loading to false
          const { container } = render(
            <Button
              variant={variant}
              size={size}
              fullWidth={fullWidth}
              disabled
              loading={false}
            >
              {children}
            </Button>
          );
          const button = container.querySelector('button');

          if (!button) return false;

          // Button must be disabled
          expect(button.disabled).toBe(true);

          // aria-busy must be "false"
          expect(button.getAttribute('aria-busy')).toBe('false');

          // Spinner SVG must NOT be present
          const spinner = button.querySelector('svg');
          expect(spinner).toBeNull();

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 3.5: Base button class is always present
   *
   * For any Button configuration, the base 'button' class must always be present.
   *
   * Validates: Requirements 5.1
   */
  it('Property 3.5: Base button class is always present', () => {
    fc.assert(
      fc.property(
        buttonPropsArb,
        childrenArb,
        (props, children) => {
          const { container } = render(<Button {...props}>{children}</Button>);
          const button = container.querySelector('button');

          if (!button) return false;

          // Base 'button' class must always be present
          expect(button.className).toContain('button');

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 3.6: Children are always rendered
   *
   * For any Button configuration and any non-empty children,
   * the children content must be present in the button's text content.
   *
   * Validates: Requirements 5.1
   */
  it('Property 3.6: Children are always rendered', () => {
    fc.assert(
      fc.property(
        buttonPropsArb,
        childrenArb,
        (props, children) => {
          const { container } = render(<Button {...props}>{children}</Button>);
          const button = container.querySelector('button');

          if (!button) return false;

          // Children must be present in text content
          expect(button.textContent).toContain(children);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
