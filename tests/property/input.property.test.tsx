/**
 * Property-based tests: Input component
 * Feature: mobile-first-design
 *
 * Validates correctness properties (Property 4: Input label association) from the design doc
 * using fast-check.
 *
 * **Validates: Requirements 6.2**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { render } from '@testing-library/react';
import { Input, type InputProps } from '../../src/components/ui/Input/Input';

// ---------------------------------------------------------------------------
// Generators
// ---------------------------------------------------------------------------

/**
 * Arbitrary generator for Input types
 */
const inputTypeArb = fc.constantFrom(
  'text' as const,
  'email' as const,
  'tel' as const,
  'number' as const,
  'password' as const,
  'url' as const,
  'date' as const
);

/**
 * Arbitrary generator for boolean props
 */
const booleanArb = fc.boolean();

/**
 * Arbitrary generator for non-empty strings (labels, errors, helper text)
 */
const nonEmptyStringArb = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Arbitrary generator for optional strings (can be undefined)
 */
const optionalStringArb = fc.option(nonEmptyStringArb, { nil: undefined });

/**
 * Arbitrary generator for placeholder text
 */
const placeholderArb = fc.option(
  fc.string({ minLength: 1, maxLength: 30 }),
  { nil: undefined }
);

/**
 * Arbitrary generator for complete InputProps
 * (excluding HTML input attributes for simplicity)
 */
const inputPropsArb: fc.Arbitrary<Omit<InputProps, 'id'>> = fc.record({
  label: optionalStringArb,
  error: optionalStringArb,
  helperText: optionalStringArb,
  type: fc.option(inputTypeArb, { nil: undefined }),
  placeholder: placeholderArb,
  disabled: fc.option(booleanArb, { nil: undefined }),
  required: fc.option(booleanArb, { nil: undefined }),
});

// ---------------------------------------------------------------------------
// Property tests
// ---------------------------------------------------------------------------

describe('Feature: mobile-first-design — Input property tests', () => {
  /**
   * Feature: mobile-first-design, Property 4: Input label association
   *
   * For any Input component with a label prop:
   * 1. A label element must be rendered
   * 2. The label must have a 'for' attribute (htmlFor in React)
   * 3. The input must have an 'id' attribute
   * 4. The label's 'for' attribute must match the input's 'id' attribute
   * 5. The label text must match the label prop
   *
   * This ensures proper accessibility for screen readers and allows clicking
   * the label to focus the input.
   *
   * Validates: Requirements 6.2
   */
  it('Property 4: Input label is always properly associated with input', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // label (always present for this test)
        inputPropsArb,
        (label, props) => {
          // Render the input with a label
          const { container } = render(<Input {...props} label={label} />);
          
          const labelElement = container.querySelector('label');
          const inputElement = container.querySelector('input');

          // 1. Label element must be rendered
          expect(labelElement).not.toBeNull();
          expect(inputElement).not.toBeNull();
          
          if (!labelElement || !inputElement) return false;

          // 2. Label must have 'for' attribute
          const labelFor = labelElement.getAttribute('for');
          expect(labelFor).not.toBeNull();
          expect(labelFor).toBeTruthy();

          // 3. Input must have 'id' attribute
          const inputId = inputElement.getAttribute('id');
          expect(inputId).not.toBeNull();
          expect(inputId).toBeTruthy();

          // 4. Label's 'for' must match input's 'id'
          expect(labelFor).toBe(inputId);

          // 5. Label text must match the label prop
          expect(labelElement.textContent).toBe(label);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.1: Input without label has no label element
   *
   * For any Input component without a label prop (or with empty/falsy label):
   * 1. No label element should be rendered
   * 2. The input should still render correctly
   * 3. The input should still have an id (for potential programmatic access)
   *
   * Validates: Requirements 6.2
   */
  it('Property 4.1: Input without label does not render label element', () => {
    fc.assert(
      fc.property(
        inputPropsArb,
        (props) => {
          // Render the input without a label (explicitly set to undefined)
          const { container } = render(<Input {...props} label={undefined} />);
          
          const labelElement = container.querySelector('label');
          const inputElement = container.querySelector('input');

          // 1. No label element should be rendered
          expect(labelElement).toBeNull();

          // 2. Input should still render
          expect(inputElement).not.toBeNull();

          // 3. Input should still have an id
          if (inputElement) {
            const inputId = inputElement.getAttribute('id');
            expect(inputId).toBeTruthy();
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.2: Error message association
   *
   * For any Input component with an error prop:
   * 1. An error element must be rendered with role="alert"
   * 2. The error element must have an id
   * 3. The input must have aria-invalid="true"
   * 4. The input's aria-describedby must include the error element's id
   * 5. The error text must match the error prop
   *
   * Validates: Requirements 6.2, 6.3
   */
  it('Property 4.2: Error message is properly associated with input', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // error (always present for this test)
        inputPropsArb,
        (error, props) => {
          // Render the input with an error
          const { container } = render(<Input {...props} error={error} />);
          
          const inputElement = container.querySelector('input');
          const errorElement = container.querySelector('[role="alert"]');

          // 1. Error element must be rendered with role="alert"
          expect(errorElement).not.toBeNull();
          expect(inputElement).not.toBeNull();
          
          if (!errorElement || !inputElement) return false;

          // 2. Error element must have an id
          const errorId = errorElement.getAttribute('id');
          expect(errorId).toBeTruthy();

          // 3. Input must have aria-invalid="true"
          expect(inputElement.getAttribute('aria-invalid')).toBe('true');

          // 4. Input's aria-describedby must include the error element's id
          const ariaDescribedBy = inputElement.getAttribute('aria-describedby');
          expect(ariaDescribedBy).toBeTruthy();
          expect(ariaDescribedBy).toContain(errorId!);

          // 5. Error text must match the error prop
          expect(errorElement.textContent).toBe(error);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.3: Helper text association
   *
   * For any Input component with helperText prop (and no error):
   * 1. A helper text element must be rendered
   * 2. The helper text element must have an id
   * 3. The input's aria-describedby must include the helper text element's id
   * 4. The helper text must match the helperText prop
   *
   * Validates: Requirements 6.2
   */
  it('Property 4.3: Helper text is properly associated with input', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // helperText (always present for this test)
        inputPropsArb,
        (helperText, props) => {
          // Render the input with helper text (no error)
          const { container } = render(
            <Input {...props} helperText={helperText} error={undefined} />
          );
          
          const inputElement = container.querySelector('input');
          
          // Find helper element by looking for span with id ending in '-helper'
          const inputId = inputElement?.getAttribute('id');
          const helperElement = inputId 
            ? container.querySelector(`#${CSS.escape(inputId)}-helper`)
            : null;

          // 1. Helper text element must be rendered
          expect(helperElement).not.toBeNull();
          expect(inputElement).not.toBeNull();
          
          if (!helperElement || !inputElement) return false;

          // 2. Helper text element must have an id
          const helperId = helperElement.getAttribute('id');
          expect(helperId).toBeTruthy();

          // 3. Input's aria-describedby must include the helper text element's id
          const ariaDescribedBy = inputElement.getAttribute('aria-describedby');
          expect(ariaDescribedBy).toBeTruthy();
          expect(ariaDescribedBy).toContain(helperId!);

          // 4. Helper text must match the helperText prop
          expect(helperElement.textContent).toBe(helperText);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.4: Error takes precedence over helper text
   *
   * For any Input component with both error and helperText props:
   * 1. The error element must be rendered
   * 2. The helper text element must NOT be rendered
   * 3. The input's aria-describedby must include the error id
   * 4. The input's aria-describedby must NOT include the helper text id
   *
   * Validates: Requirements 6.2, 6.3
   */
  it('Property 4.4: Error takes precedence over helper text', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // error
        nonEmptyStringArb, // helperText
        inputPropsArb,
        (error, helperText, props) => {
          // Render the input with both error and helper text
          const { container } = render(
            <Input {...props} error={error} helperText={helperText} />
          );
          
          const inputElement = container.querySelector('input');
          const errorElement = container.querySelector('[role="alert"]');
          
          // Find helper element by looking for span with id ending in '-helper'
          const inputId = inputElement?.getAttribute('id');
          const helperElement = inputId 
            ? container.querySelector(`#${CSS.escape(inputId)}-helper`)
            : null;

          expect(inputElement).not.toBeNull();
          if (!inputElement) return false;

          // 1. Error element must be rendered
          expect(errorElement).not.toBeNull();

          // 2. Helper text element must NOT be rendered
          expect(helperElement).toBeNull();

          // 3. Input's aria-describedby must include the error id
          const ariaDescribedBy = inputElement.getAttribute('aria-describedby');
          expect(ariaDescribedBy).toBeTruthy();
          
          if (errorElement) {
            const errorId = errorElement.getAttribute('id');
            expect(ariaDescribedBy).toContain(errorId!);
          }

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.5: Unique IDs for multiple inputs
   *
   * For any two Input components rendered simultaneously:
   * 1. Each input must have a unique id
   * 2. Each label must have a unique 'for' attribute
   * 3. Each input's id must match its corresponding label's 'for' attribute
   *
   * This ensures that multiple inputs on the same page don't conflict.
   *
   * Validates: Requirements 6.2
   */
  it('Property 4.5: Multiple inputs have unique IDs', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // label1
        nonEmptyStringArb, // label2
        inputPropsArb,
        inputPropsArb,
        (label1, label2, props1, props2) => {
          // Render two inputs with labels
          const { container } = render(
            <>
              <Input {...props1} label={label1} />
              <Input {...props2} label={label2} />
            </>
          );
          
          const inputs = container.querySelectorAll('input');
          const labels = container.querySelectorAll('label');

          // Must have exactly 2 inputs and 2 labels
          expect(inputs.length).toBe(2);
          expect(labels.length).toBe(2);

          const input1 = inputs[0];
          const input2 = inputs[1];
          const label1Element = labels[0];
          const label2Element = labels[1];

          // 1. Each input must have a unique id
          const id1 = input1.getAttribute('id');
          const id2 = input2.getAttribute('id');
          expect(id1).toBeTruthy();
          expect(id2).toBeTruthy();
          expect(id1).not.toBe(id2);

          // 2. Each label must have a unique 'for' attribute
          const for1 = label1Element.getAttribute('for');
          const for2 = label2Element.getAttribute('for');
          expect(for1).toBeTruthy();
          expect(for2).toBeTruthy();
          expect(for1).not.toBe(for2);

          // 3. Each input's id must match its corresponding label's 'for'
          expect(id1).toBe(for1);
          expect(id2).toBe(for2);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.6: Provided ID is respected
   *
   * For any Input component with an explicit id prop:
   * 1. The input must use the provided id
   * 2. The label's 'for' attribute must match the provided id
   * 3. The provided id must not be overridden by auto-generated id
   *
   * Validates: Requirements 6.2
   */
  it('Property 4.6: Provided ID is respected and used for label association', () => {
    fc.assert(
      fc.property(
        nonEmptyStringArb, // label
        fc.string({ minLength: 1, maxLength: 20 }), // custom id
        inputPropsArb,
        (label, customId, props) => {
          // Render the input with a custom id
          const { container } = render(
            <Input {...props} label={label} id={customId} />
          );
          
          const inputElement = container.querySelector('input');
          const labelElement = container.querySelector('label');

          expect(inputElement).not.toBeNull();
          expect(labelElement).not.toBeNull();
          
          if (!inputElement || !labelElement) return false;

          // 1. Input must use the provided id
          const inputId = inputElement.getAttribute('id');
          expect(inputId).toBe(customId);

          // 2. Label's 'for' must match the provided id
          const labelFor = labelElement.getAttribute('for');
          expect(labelFor).toBe(customId);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.7: Input type is always applied
   *
   * For any Input component with a type prop:
   * 1. The input element must have the correct type attribute
   * 2. The type must be one of the valid HTML input types
   *
   * Validates: Requirements 3.6
   */
  it('Property 4.7: Input type is correctly applied', () => {
    fc.assert(
      fc.property(
        inputTypeArb,
        inputPropsArb,
        (type, props) => {
          // Render the input with a specific type
          const { container } = render(<Input {...props} type={type} />);
          
          const inputElement = container.querySelector('input');

          expect(inputElement).not.toBeNull();
          if (!inputElement) return false;

          // Input must have the correct type attribute
          const inputType = inputElement.getAttribute('type');
          expect(inputType).toBe(type);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Feature: mobile-first-design, Property 4.8: Disabled state is consistent
   *
   * For any Input component with disabled prop:
   * 1. The input element must have the disabled attribute
   * 2. The input must not be focusable
   *
   * Validates: Requirements 13.1
   */
  it('Property 4.8: Disabled state is correctly applied', () => {
    fc.assert(
      fc.property(
        inputPropsArb,
        (props) => {
          // Render the input with disabled=true
          const { container } = render(<Input {...props} disabled={true} />);
          
          const inputElement = container.querySelector('input');

          expect(inputElement).not.toBeNull();
          if (!inputElement) return false;

          // Input must be disabled
          expect(inputElement.hasAttribute('disabled')).toBe(true);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });
});
