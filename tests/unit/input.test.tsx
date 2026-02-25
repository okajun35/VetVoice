/**
 * Unit tests: Input component
 * Feature: mobile-first-design
 *
 * Tests the Input component rendering with different states and props.
 * Validates Requirements: 6.2, 13.1, 13.6
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Input } from '../../src/components/ui/Input/Input';

describe('Input component', () => {
  // ---------------------------------------------------------------------------
  // Label association tests (Requirement 6.2)
  // ---------------------------------------------------------------------------
  describe('label association', () => {
    it('associates label with input using htmlFor and id', () => {
      render(<Input label="Username" />);
      const input = screen.getByLabelText('Username');
      expect(input).toBeInTheDocument();
    });

    it('uses provided id for label association', () => {
      render(<Input label="Email" id="email-input" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('id', 'email-input');
    });

    it('generates unique id when not provided', () => {
      const { container } = render(<Input label="Password" />);
      const input = container.querySelector('input');
      const label = container.querySelector('label');
      
      expect(input).not.toBeNull();
      expect(label).not.toBeNull();
      
      if (input && label) {
        const inputId = input.getAttribute('id');
        const labelFor = label.getAttribute('for');
        
        expect(inputId).toBeTruthy();
        expect(labelFor).toBeTruthy();
        expect(inputId).toBe(labelFor);
      }
    });

    it('renders without label when label prop is not provided', () => {
      const { container } = render(<Input placeholder="Enter text" />);
      const label = container.querySelector('label');
      expect(label).toBeNull();
    });

    it('renders input without label but with id', () => {
      render(<Input id="no-label-input" placeholder="No label" />);
      const input = screen.getByPlaceholderText('No label');
      expect(input).toHaveAttribute('id', 'no-label-input');
    });
  });

  // ---------------------------------------------------------------------------
  // Error state tests (Requirement 13.1, 13.6)
  // ---------------------------------------------------------------------------
  describe('error state', () => {
    it('displays error message when error prop is provided', () => {
      render(<Input label="Email" error="Invalid email address" />);
      const errorMessage = screen.getByText('Invalid email address');
      expect(errorMessage).toBeInTheDocument();
    });

    it('applies error class to input when error is present', () => {
      const { container } = render(<Input label="Email" error="Invalid email" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('input--error');
    });

    it('sets aria-invalid to true when error is present', () => {
      render(<Input label="Email" error="Invalid email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('associates error message with input using aria-describedby', () => {
      const { container } = render(<Input label="Email" error="Invalid email" />);
      const input = container.querySelector('input');
      const errorElement = container.querySelector('[role="alert"]');
      
      expect(input).not.toBeNull();
      expect(errorElement).not.toBeNull();
      
      if (input && errorElement) {
        const ariaDescribedBy = input.getAttribute('aria-describedby');
        const errorId = errorElement.getAttribute('id');
        
        expect(ariaDescribedBy).toBeTruthy();
        expect(errorId).toBeTruthy();
        expect(ariaDescribedBy).toContain(errorId!);
      }
    });

    it('error message has role="alert" for screen reader announcement', () => {
      render(<Input label="Email" error="Invalid email" />);
      const errorMessage = screen.getByRole('alert');
      expect(errorMessage).toHaveTextContent('Invalid email');
    });

    it('does not display error message when error prop is not provided', () => {
      const { container } = render(<Input label="Email" />);
      const errorElement = container.querySelector('[role="alert"]');
      expect(errorElement).toBeNull();
    });

    it('does not set aria-invalid when error is not present', () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).not.toHaveAttribute('aria-invalid', 'true');
    });

    it('hides helper text when error is present', () => {
      render(
        <Input label="Email" helperText="Enter your email" error="Invalid email" />
      );
      
      const helperText = screen.queryByText('Enter your email');
      const errorText = screen.getByText('Invalid email');
      
      expect(helperText).toBeNull();
      expect(errorText).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled state tests (Requirement 13.1)
  // ---------------------------------------------------------------------------
  describe('disabled state', () => {
    it('is disabled when disabled prop is true', () => {
      render(<Input label="Username" disabled />);
      const input = screen.getByLabelText('Username');
      expect(input).toBeDisabled();
    });

    it('is not disabled when disabled prop is false', () => {
      render(<Input label="Username" disabled={false} />);
      const input = screen.getByLabelText('Username');
      expect(input).not.toBeDisabled();
    });

    it('is not disabled by default', () => {
      render(<Input label="Username" />);
      const input = screen.getByLabelText('Username');
      expect(input).not.toBeDisabled();
    });

    it('can be disabled with error state', () => {
      render(<Input label="Email" error="Invalid email" disabled />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });
  });

  // ---------------------------------------------------------------------------
  // Input type tests (Requirement 3.6)
  // ---------------------------------------------------------------------------
  describe('different input types', () => {
    it('renders text input by default', () => {
      render(<Input label="Name" />);
      const input = screen.getByLabelText('Name');
      // HTML inputs default to type="text" even without explicit attribute
      expect(input.tagName).toBe('INPUT');
    });

    it('renders email input when type is email', () => {
      render(<Input label="Email" type="email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('type', 'email');
    });

    it('renders tel input when type is tel', () => {
      render(<Input label="Phone" type="tel" />);
      const input = screen.getByLabelText('Phone');
      expect(input).toHaveAttribute('type', 'tel');
    });

    it('renders number input when type is number', () => {
      render(<Input label="Age" type="number" />);
      const input = screen.getByLabelText('Age');
      expect(input).toHaveAttribute('type', 'number');
    });

    it('renders password input when type is password', () => {
      render(<Input label="Password" type="password" />);
      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('type', 'password');
    });

    it('renders url input when type is url', () => {
      render(<Input label="Website" type="url" />);
      const input = screen.getByLabelText('Website');
      expect(input).toHaveAttribute('type', 'url');
    });

    it('renders date input when type is date', () => {
      render(<Input label="Birth Date" type="date" />);
      const input = screen.getByLabelText('Birth Date');
      expect(input).toHaveAttribute('type', 'date');
    });
  });

  // ---------------------------------------------------------------------------
  // Helper text tests
  // ---------------------------------------------------------------------------
  describe('helper text', () => {
    it('displays helper text when helperText prop is provided', () => {
      render(<Input label="Username" helperText="Choose a unique username" />);
      const helperText = screen.getByText('Choose a unique username');
      expect(helperText).toBeInTheDocument();
    });

    it('associates helper text with input using aria-describedby', () => {
      const { container } = render(
        <Input label="Username" helperText="Choose a unique username" />
      );
      const input = container.querySelector('input');
      const helperElement = screen.getByText('Choose a unique username');
      
      expect(input).not.toBeNull();
      
      if (input) {
        const ariaDescribedBy = input.getAttribute('aria-describedby');
        const helperId = helperElement.getAttribute('id');
        
        expect(ariaDescribedBy).toBeTruthy();
        expect(helperId).toBeTruthy();
        expect(ariaDescribedBy).toContain(helperId!);
      }
    });

    it('does not display helper text when helperText prop is not provided', () => {
      const { container } = render(<Input label="Username" />);
      const helperElement = container.querySelector('.helper');
      expect(helperElement).toBeNull();
    });

    it('associates both error and helper text when both are present', () => {
      const { container } = render(
        <Input
          label="Email"
          helperText="We'll never share your email"
          error="Invalid email"
        />
      );
      const input = container.querySelector('input');
      const errorElement = container.querySelector('[role="alert"]');
      
      expect(input).not.toBeNull();
      expect(errorElement).not.toBeNull();
      
      if (input && errorElement) {
        const ariaDescribedBy = input.getAttribute('aria-describedby');
        const errorId = errorElement.getAttribute('id');
        
        expect(ariaDescribedBy).toBeTruthy();
        expect(errorId).toBeTruthy();
        expect(ariaDescribedBy).toContain(errorId!);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Placeholder tests
  // ---------------------------------------------------------------------------
  describe('placeholder', () => {
    it('displays placeholder text', () => {
      render(<Input label="Email" placeholder="you@example.com" />);
      const input = screen.getByPlaceholderText('you@example.com');
      expect(input).toBeInTheDocument();
    });

    it('renders without placeholder when not provided', () => {
      render(<Input label="Email" />);
      const input = screen.getByLabelText('Email');
      expect(input).not.toHaveAttribute('placeholder');
    });
  });

  // ---------------------------------------------------------------------------
  // Custom className tests
  // ---------------------------------------------------------------------------
  describe('custom className', () => {
    it('applies custom className alongside default classes', () => {
      const { container } = render(<Input label="Name" className="custom-input" />);
      const input = container.querySelector('input');
      expect(input?.className).toContain('custom-input');
      expect(input?.className).toContain('input');
    });

    it('does not break when className is undefined', () => {
      render(<Input label="Name" />);
      const input = screen.getByLabelText('Name');
      expect(input).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // HTML input attributes tests
  // ---------------------------------------------------------------------------
  describe('HTML input attributes', () => {
    it('passes through required attribute', () => {
      render(<Input label="Email" required />);
      const input = screen.getByLabelText('Email');
      expect(input).toBeRequired();
    });

    it('passes through readOnly attribute', () => {
      render(<Input label="Username" readOnly />);
      const input = screen.getByLabelText('Username');
      expect(input).toHaveAttribute('readOnly');
    });

    it('passes through maxLength attribute', () => {
      render(<Input label="Username" maxLength={20} />);
      const input = screen.getByLabelText('Username');
      expect(input).toHaveAttribute('maxLength', '20');
    });

    it('passes through minLength attribute', () => {
      render(<Input label="Password" minLength={8} />);
      const input = screen.getByLabelText('Password');
      expect(input).toHaveAttribute('minLength', '8');
    });

    it('passes through pattern attribute', () => {
      render(<Input label="Code" pattern="[0-9]{4}" />);
      const input = screen.getByLabelText('Code');
      expect(input).toHaveAttribute('pattern', '[0-9]{4}');
    });

    it('passes through autoComplete attribute', () => {
      render(<Input label="Email" autoComplete="email" />);
      const input = screen.getByLabelText('Email');
      expect(input).toHaveAttribute('autoComplete', 'email');
    });

    it('passes through data attributes', () => {
      render(<Input label="Name" data-testid="name-input" />);
      const input = screen.getByTestId('name-input');
      expect(input).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Combined states tests
  // ---------------------------------------------------------------------------
  describe('combined states', () => {
    it('renders with label, error, and disabled state', () => {
      render(<Input label="Email" error="Invalid email" disabled />);
      const input = screen.getByLabelText('Email');
      const errorMessage = screen.getByText('Invalid email');
      
      expect(input).toBeDisabled();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(errorMessage).toBeInTheDocument();
    });

    it('renders with label, helper text, and custom type', () => {
      render(
        <Input
          label="Phone"
          type="tel"
          helperText="Include country code"
          placeholder="+1 234 567 8900"
        />
      );
      const input = screen.getByLabelText('Phone');
      const helperText = screen.getByText('Include country code');
      
      expect(input).toHaveAttribute('type', 'tel');
      expect(input).toHaveAttribute('placeholder', '+1 234 567 8900');
      expect(helperText).toBeInTheDocument();
    });

    it('renders with all props combined', () => {
      render(
        <Input
          label="Username"
          type="text"
          placeholder="Enter username"
          helperText="Must be unique"
          required
          minLength={3}
          maxLength={20}
          className="custom-class"
        />
      );
      const input = screen.getByLabelText('Username');
      const helperText = screen.getByText('Must be unique');
      
      expect(input).toHaveAttribute('type', 'text');
      expect(input).toHaveAttribute('placeholder', 'Enter username');
      expect(input).toBeRequired();
      expect(input).toHaveAttribute('minLength', '3');
      expect(input).toHaveAttribute('maxLength', '20');
      expect(input.className).toContain('custom-class');
      expect(helperText).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('does not render label when label is empty string', () => {
      const { container } = render(<Input label="" />);
      const label = container.querySelector('label');
      // Empty string is falsy, so label should not be rendered
      expect(label).toBeNull();
    });

    it('does not render error when error is empty string', () => {
      const { container } = render(<Input label="Email" error="" />);
      const errorElement = container.querySelector('[role="alert"]');
      // Empty string is falsy, so error should not be rendered
      expect(errorElement).toBeNull();
    });

    it('does not render helper text when helperText is empty string', () => {
      const { container } = render(<Input label="Name" helperText="" />);
      const helperElement = container.querySelector('.helper');
      // Empty string is falsy, so helper text should not be rendered
      expect(helperElement).toBeNull();
    });

    it('handles null className gracefully', () => {
      render(<Input label="Name" className={undefined} />);
      const input = screen.getByLabelText('Name');
      expect(input).toBeInTheDocument();
    });

    it('handles multiple inputs with auto-generated ids', () => {
      const { container } = render(
        <>
          <Input label="First Name" />
          <Input label="Last Name" />
        </>
      );
      
      const inputs = container.querySelectorAll('input');
      expect(inputs).toHaveLength(2);
      
      const firstId = inputs[0].getAttribute('id');
      const secondId = inputs[1].getAttribute('id');
      
      expect(firstId).toBeTruthy();
      expect(secondId).toBeTruthy();
      expect(firstId).not.toBe(secondId);
    });
  });
});
