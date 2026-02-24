/**
 * Unit tests: Toast component
 * Feature: mobile-first-design
 *
 * Tests the Toast component rendering with different types, auto-dismiss behavior,
 * and manual close functionality.
 * Validates Requirements: 5.7, 6.3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Toast } from '../../src/components/ui/Toast/Toast';

describe('Toast component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Type rendering tests (Requirement 5.7)
  // ---------------------------------------------------------------------------
  describe('type rendering', () => {
    it('renders with info type by default', () => {
      const onClose = vi.fn();
      render(<Toast message="Default toast" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
      expect(toast.className).toContain('toast--info');
    });

    it('renders with info type when explicitly specified', () => {
      const onClose = vi.fn();
      render(<Toast message="Info message" type="info" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--info');
    });

    it('renders with success type', () => {
      const onClose = vi.fn();
      render(<Toast message="Success message" type="success" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--success');
    });

    it('renders with error type', () => {
      const onClose = vi.fn();
      render(<Toast message="Error message" type="error" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--error');
    });

    it('renders with warning type', () => {
      const onClose = vi.fn();
      render(<Toast message="Warning message" type="warning" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--warning');
    });
  });

  // ---------------------------------------------------------------------------
  // Message rendering tests (Requirement 5.7)
  // ---------------------------------------------------------------------------
  describe('message rendering', () => {
    it('displays the provided message', () => {
      const onClose = vi.fn();
      render(<Toast message="Test message" onClose={onClose} />);
      expect(screen.getByText('Test message')).toBeInTheDocument();
    });

    it('displays long messages', () => {
      const onClose = vi.fn();
      const longMessage = 'This is a very long message that should still be displayed correctly in the toast notification component.';
      render(<Toast message={longMessage} onClose={onClose} />);
      expect(screen.getByText(longMessage)).toBeInTheDocument();
    });

    it('displays empty string message', () => {
      const onClose = vi.fn();
      render(<Toast message="" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-dismiss tests (Requirement 5.7)
  // ---------------------------------------------------------------------------
  describe('auto-dismiss behavior', () => {
    it('calls onClose after default duration (3000ms)', () => {
      const onClose = vi.fn();
      render(<Toast message="Auto dismiss" onClose={onClose} />);
      
      expect(onClose).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(3000);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose after custom duration', () => {
      const onClose = vi.fn();
      render(<Toast message="Custom duration" duration={5000} onClose={onClose} />);
      
      expect(onClose).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(4999);
      expect(onClose).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not auto-dismiss when duration is 0', () => {
      const onClose = vi.fn();
      render(<Toast message="No auto dismiss" duration={0} onClose={onClose} />);
      
      vi.advanceTimersByTime(10000);
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not auto-dismiss when duration is negative', () => {
      const onClose = vi.fn();
      render(<Toast message="Negative duration" duration={-1} onClose={onClose} />);
      
      vi.advanceTimersByTime(10000);
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('clears timer on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(<Toast message="Unmount test" onClose={onClose} />);
      
      unmount();
      vi.advanceTimersByTime(3000);
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Manual close button tests (Requirement 5.7)
  // ---------------------------------------------------------------------------
  describe('manual close button', () => {
    it('renders close button', () => {
      const onClose = vi.fn();
      render(<Toast message="With close button" onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      expect(closeButton).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<Toast message="Click to close" onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      
      closeButton.click();
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('close button has proper aria-label', () => {
      const onClose = vi.fn();
      render(<Toast message="Aria label test" onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      expect(closeButton).toHaveAttribute('aria-label', 'Close notification');
    });

    it('close button displays × symbol', () => {
      const onClose = vi.fn();
      render(<Toast message="Symbol test" onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      expect(closeButton.textContent).toBe('×');
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility tests (Requirement 6.3)
  // ---------------------------------------------------------------------------
  describe('accessibility', () => {
    it('has role="alert" for screen reader announcement', () => {
      const onClose = vi.fn();
      render(<Toast message="Accessible toast" onClose={onClose} />);
      const toast = screen.getByRole('alert');
      expect(toast).toHaveAttribute('role', 'alert');
    });

    it('announces message to screen readers', () => {
      const onClose = vi.fn();
      render(<Toast message="Important notification" onClose={onClose} />);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent('Important notification');
    });

    it('close button is keyboard accessible', () => {
      const onClose = vi.fn();
      render(<Toast message="Keyboard test" onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      expect(closeButton).toHaveAttribute('type', 'button');
    });
  });

  // ---------------------------------------------------------------------------
  // Combined states tests
  // ---------------------------------------------------------------------------
  describe('combined states', () => {
    it('renders success toast with custom duration', () => {
      const onClose = vi.fn();
      render(
        <Toast 
          message="Success with custom duration" 
          type="success" 
          duration={2000} 
          onClose={onClose} 
        />
      );
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--success');
      expect(screen.getByText('Success with custom duration')).toBeInTheDocument();
      
      vi.advanceTimersByTime(2000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders error toast without auto-dismiss', () => {
      const onClose = vi.fn();
      render(
        <Toast 
          message="Error - manual close only" 
          type="error" 
          duration={0} 
          onClose={onClose} 
        />
      );
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--error');
      
      vi.advanceTimersByTime(10000);
      expect(onClose).not.toHaveBeenCalled();
      
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      closeButton.click();
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('renders warning toast with short duration', () => {
      const onClose = vi.fn();
      render(
        <Toast 
          message="Quick warning" 
          type="warning" 
          duration={1000} 
          onClose={onClose} 
        />
      );
      const toast = screen.getByRole('alert');
      expect(toast.className).toContain('toast--warning');
      
      vi.advanceTimersByTime(1000);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles very short duration (1ms)', () => {
      const onClose = vi.fn();
      render(<Toast message="Very short" duration={1} onClose={onClose} />);
      
      vi.advanceTimersByTime(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles very long duration', () => {
      const onClose = vi.fn();
      render(<Toast message="Very long" duration={999999} onClose={onClose} />);
      
      vi.advanceTimersByTime(999998);
      expect(onClose).not.toHaveBeenCalled();
      
      vi.advanceTimersByTime(1);
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('handles multiple rapid clicks on close button', () => {
      const onClose = vi.fn();
      render(<Toast message="Rapid clicks" onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      
      closeButton.click();
      closeButton.click();
      closeButton.click();
      
      expect(onClose).toHaveBeenCalledTimes(3);
    });

    it('handles onClose being called before timer expires', () => {
      const onClose = vi.fn();
      render(<Toast message="Manual close before timer" duration={5000} onClose={onClose} />);
      const closeButton = screen.getByRole('button', { name: 'Close notification' });
      
      vi.advanceTimersByTime(2000);
      closeButton.click();
      
      expect(onClose).toHaveBeenCalledTimes(1);
      
      vi.advanceTimersByTime(3000);
      // Should not be called again by timer
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
