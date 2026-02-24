/**
 * Unit tests: Button component
 * Feature: mobile-first-design
 *
 * Tests the Button component rendering with different variants, states, and props.
 * Validates Requirements: 3.3, 3.4, 5.1
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../../src/components/ui/Button/Button';

describe('Button component', () => {
  // ---------------------------------------------------------------------------
  // Variant rendering tests (Requirement 5.1)
  // ---------------------------------------------------------------------------
  describe('variant rendering', () => {
    it('renders with primary variant by default', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button', { name: 'Click me' });
      expect(button).toBeInTheDocument();
      expect(button.className).toContain('button--primary');
    });

    it('renders with primary variant when explicitly specified', () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button', { name: 'Primary' });
      expect(button.className).toContain('button--primary');
    });

    it('renders with secondary variant', () => {
      render(<Button variant="secondary">Secondary</Button>);
      const button = screen.getByRole('button', { name: 'Secondary' });
      expect(button.className).toContain('button--secondary');
    });

    it('renders with danger variant', () => {
      render(<Button variant="danger">Delete</Button>);
      const button = screen.getByRole('button', { name: 'Delete' });
      expect(button.className).toContain('button--danger');
    });

    it('renders with ghost variant', () => {
      render(<Button variant="ghost">Ghost</Button>);
      const button = screen.getByRole('button', { name: 'Ghost' });
      expect(button.className).toContain('button--ghost');
    });
  });

  // ---------------------------------------------------------------------------
  // Size rendering tests (Requirement 5.1)
  // ---------------------------------------------------------------------------
  describe('size rendering', () => {
    it('renders with medium size by default', () => {
      render(<Button>Medium</Button>);
      const button = screen.getByRole('button', { name: 'Medium' });
      expect(button.className).toContain('button--md');
    });

    it('renders with small size', () => {
      render(<Button size="sm">Small</Button>);
      const button = screen.getByRole('button', { name: 'Small' });
      expect(button.className).toContain('button--sm');
    });

    it('renders with medium size when explicitly specified', () => {
      render(<Button size="md">Medium</Button>);
      const button = screen.getByRole('button', { name: 'Medium' });
      expect(button.className).toContain('button--md');
    });

    it('renders with large size', () => {
      render(<Button size="lg">Large</Button>);
      const button = screen.getByRole('button', { name: 'Large' });
      expect(button.className).toContain('button--lg');
    });
  });

  // ---------------------------------------------------------------------------
  // Loading state tests (Requirement 3.3)
  // ---------------------------------------------------------------------------
  describe('loading state', () => {
    it('displays spinner when loading is true', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      
      // Check for spinner SVG element
      const svg = button.querySelector('svg');
      expect(svg).not.toBeNull();
      
      // Check for spinner span with aria-hidden
      const spinnerSpan = button.querySelector('span[aria-hidden="true"]');
      expect(spinnerSpan).not.toBeNull();
    });

    it('sets aria-busy to true when loading', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('disables button when loading is true', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      expect(button).toBeDisabled();
    });

    it('renders both spinner and content when loading', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      
      // Should have SVG spinner
      const svg = button.querySelector('svg');
      expect(svg).not.toBeNull();
      
      // Should still have content text
      expect(button.textContent).toContain('Submit');
    });

    it('does not display spinner when loading is false', () => {
      render(<Button loading={false}>Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      const svg = button.querySelector('svg');
      expect(svg).toBeNull();
    });

    it('does not set aria-busy when loading is false', () => {
      render(<Button loading={false}>Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      expect(button).toHaveAttribute('aria-busy', 'false');
    });
  });

  // ---------------------------------------------------------------------------
  // Disabled state tests (Requirement 3.4)
  // ---------------------------------------------------------------------------
  describe('disabled state', () => {
    it('is disabled when disabled prop is true', () => {
      render(<Button disabled>Disabled</Button>);
      const button = screen.getByRole('button', { name: 'Disabled' });
      expect(button).toBeDisabled();
    });

    it('is not disabled when disabled prop is false', () => {
      render(<Button disabled={false}>Enabled</Button>);
      const button = screen.getByRole('button', { name: 'Enabled' });
      expect(button).not.toBeDisabled();
    });

    it('is not disabled by default', () => {
      render(<Button>Default</Button>);
      const button = screen.getByRole('button', { name: 'Default' });
      expect(button).not.toBeDisabled();
    });

    it('is disabled when both disabled and loading are true', () => {
      render(<Button disabled loading>Processing</Button>);
      const button = screen.getByRole('button', { name: 'Processing' });
      expect(button).toBeDisabled();
    });
  });

  // ---------------------------------------------------------------------------
  // Full width tests (Requirement 5.1)
  // ---------------------------------------------------------------------------
  describe('fullWidth prop', () => {
    it('applies full width class when fullWidth is true', () => {
      render(<Button fullWidth>Full Width</Button>);
      const button = screen.getByRole('button', { name: 'Full Width' });
      expect(button.className).toContain('button--full');
    });

    it('does not apply full width class when fullWidth is false', () => {
      render(<Button fullWidth={false}>Normal Width</Button>);
      const button = screen.getByRole('button', { name: 'Normal Width' });
      expect(button.className).not.toContain('button--full');
    });

    it('does not apply full width class by default', () => {
      render(<Button>Default Width</Button>);
      const button = screen.getByRole('button', { name: 'Default Width' });
      expect(button.className).not.toContain('button--full');
    });
  });

  // ---------------------------------------------------------------------------
  // Children rendering tests
  // ---------------------------------------------------------------------------
  describe('children rendering', () => {
    it('renders text children', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
    });

    it('renders complex children with elements', () => {
      render(
        <Button>
          <span>Icon</span>
          <span>Text</span>
        </Button>
      );
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.textContent).toContain('Icon');
      expect(button.textContent).toContain('Text');
    });
  });

  // ---------------------------------------------------------------------------
  // Custom className tests
  // ---------------------------------------------------------------------------
  describe('custom className', () => {
    it('applies custom className alongside default classes', () => {
      render(<Button className="custom-class">Custom</Button>);
      const button = screen.getByRole('button', { name: 'Custom' });
      expect(button.className).toContain('custom-class');
      expect(button.className).toContain('button');
      expect(button.className).toContain('button--primary');
    });

    it('does not break when className is undefined', () => {
      render(<Button>No Custom Class</Button>);
      const button = screen.getByRole('button', { name: 'No Custom Class' });
      expect(button).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // HTML button attributes tests
  // ---------------------------------------------------------------------------
  describe('HTML button attributes', () => {
    it('passes through type attribute', () => {
      render(<Button type="submit">Submit</Button>);
      const button = screen.getByRole('button', { name: 'Submit' });
      expect(button).toHaveAttribute('type', 'submit');
    });

    it('passes through onClick handler', () => {
      let clicked = false;
      const handleClick = () => { clicked = true; };
      render(<Button onClick={handleClick}>Click</Button>);
      const button = screen.getByRole('button', { name: 'Click' });
      button.click();
      expect(clicked).toBe(true);
    });

    it('passes through aria-label attribute', () => {
      render(<Button aria-label="Close dialog">×</Button>);
      const button = screen.getByRole('button', { name: 'Close dialog' });
      expect(button).toHaveAttribute('aria-label', 'Close dialog');
    });

    it('passes through data attributes', () => {
      render(<Button data-testid="my-button">Test</Button>);
      const button = screen.getByRole('button', { name: 'Test' });
      expect(button).toHaveAttribute('data-testid', 'my-button');
    });
  });

  // ---------------------------------------------------------------------------
  // Combined states tests
  // ---------------------------------------------------------------------------
  describe('combined states', () => {
    it('renders primary variant with small size', () => {
      render(<Button variant="primary" size="sm">Small Primary</Button>);
      const button = screen.getByRole('button', { name: 'Small Primary' });
      expect(button.className).toContain('button--primary');
      expect(button.className).toContain('button--sm');
    });

    it('renders danger variant with large size and full width', () => {
      render(
        <Button variant="danger" size="lg" fullWidth>
          Delete All
        </Button>
      );
      const button = screen.getByRole('button', { name: 'Delete All' });
      expect(button.className).toContain('button--danger');
      expect(button.className).toContain('button--lg');
      expect(button.className).toContain('button--full');
    });

    it('renders secondary variant in loading state', () => {
      render(<Button variant="secondary" loading>Loading</Button>);
      const button = screen.getByRole('button', { name: 'Loading' });
      expect(button.className).toContain('button--secondary');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });

    it('renders ghost variant with custom className', () => {
      render(<Button variant="ghost" className="my-ghost">Ghost</Button>);
      const button = screen.getByRole('button', { name: 'Ghost' });
      expect(button.className).toContain('button--ghost');
      expect(button.className).toContain('my-ghost');
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles empty string children', () => {
      render(<Button>{''}</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button.textContent).toBe('');
    });

    it('handles numeric children', () => {
      render(<Button>{42}</Button>);
      const button = screen.getByRole('button', { name: '42' });
      expect(button).toBeInTheDocument();
    });

    it('handles null className gracefully', () => {
      render(<Button className={undefined}>No Class</Button>);
      const button = screen.getByRole('button', { name: 'No Class' });
      expect(button).toBeInTheDocument();
    });
  });
});
