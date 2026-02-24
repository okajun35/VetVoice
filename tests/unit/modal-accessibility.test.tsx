/**
 * Accessibility tests: Modal component
 * Feature: mobile-first-design
 *
 * Tests the Modal component for WCAG AA compliance, ARIA attributes,
 * focus management, and keyboard navigation.
 * Validates Requirements: 6.1, 6.4, 6.5
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Modal } from '../../src/components/ui/Modal/Modal';

describe('Modal accessibility', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  // ---------------------------------------------------------------------------
  // ARIA attributes (Requirement 6.1)
  // ---------------------------------------------------------------------------
  describe('ARIA attributes', () => {
    it('has role="dialog"', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('role', 'dialog');
    });

    it('has aria-modal="true"', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title when title is provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Confirmation Dialog">
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      const titleId = dialog.getAttribute('aria-labelledby');
      
      expect(titleId).toBe('modal-title');
      
      const title = document.getElementById(titleId!);
      expect(title).toBeInTheDocument();
      expect(title).toHaveTextContent('Confirmation Dialog');
    });

    it('does not have aria-labelledby when title is not provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('close button has aria-label for screen readers', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
      expect(closeButton).toHaveAttribute('aria-label', 'モーダルを閉じる');
    });
  });

  // ---------------------------------------------------------------------------
  // Focus management (Requirement 6.4, 6.5)
  // ---------------------------------------------------------------------------
  describe('focus management', () => {
    it('traps focus within modal', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <button>Action 1</button>
          <button>Action 2</button>
        </Modal>
      );
      
      // Wait for initial focus
      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
        expect(closeButton).toHaveFocus();
      });
      
      // Tab through all focusable elements
      await user.tab();
      expect(screen.getByRole('button', { name: 'Action 1' })).toHaveFocus();
      
      await user.tab();
      expect(screen.getByRole('button', { name: 'Action 2' })).toHaveFocus();
      
      // Tab should wrap back to first element
      await user.tab();
      expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
    });

    it('prevents focus from leaving modal with Tab', async () => {
      const onClose = vi.fn();
      
      // Create a button outside the modal
      const ExternalButton = () => (
        <>
          <button>External Button</button>
          <Modal open={true} onClose={onClose}>
            <button>Internal Button</button>
          </Modal>
        </>
      );
      
      render(<ExternalButton />);
      
      const externalButton = screen.getByRole('button', { name: 'External Button' });
      const internalButton = screen.getByRole('button', { name: 'Internal Button' });
      
      // Wait for modal to focus first element
      await waitFor(() => {
        expect(internalButton).toHaveFocus();
      });
      
      // Tab multiple times - should never focus external button
      await user.tab();
      await user.tab();
      await user.tab();
      
      expect(externalButton).not.toHaveFocus();
    });

    it('prevents focus from leaving modal with Shift+Tab', async () => {
      const onClose = vi.fn();
      
      const ExternalButton = () => (
        <>
          <button>External Button</button>
          <Modal open={true} onClose={onClose}>
            <button>Internal Button</button>
          </Modal>
        </>
      );
      
      render(<ExternalButton />);
      
      const externalButton = screen.getByRole('button', { name: 'External Button' });
      const internalButton = screen.getByRole('button', { name: 'Internal Button' });
      
      // Wait for modal to focus first element
      await waitFor(() => {
        expect(internalButton).toHaveFocus();
      });
      
      // Shift+Tab multiple times - should never focus external button
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });
      
      expect(externalButton).not.toHaveFocus();
    });

    it('returns focus to trigger element when modal closes', async () => {
      const TriggerComponent = () => {
        const [open, setOpen] = React.useState(false);
        return (
          <>
            <button onClick={() => setOpen(true)}>Open Modal</button>
            <Modal open={open} onClose={() => setOpen(false)}>
              <p>Modal content</p>
            </Modal>
          </>
        );
      };
      
      render(<TriggerComponent />);
      
      const triggerButton = screen.getByRole('button', { name: 'Open Modal' });
      
      // Open modal
      await user.click(triggerButton);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Close modal with Escape
      await user.keyboard('{Escape}');
      
      // Focus should return to trigger button
      await waitFor(() => {
        expect(triggerButton).toHaveFocus();
      });
    });

    it('focuses first focusable element when modal opens', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <button>First Action</button>
        </Modal>
      );
      
      // First focusable element (close button) should receive focus
      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
        expect(closeButton).toHaveFocus();
      });
    });

    it('handles modal with no focusable elements gracefully', () => {
      const onClose = vi.fn();
      
      // Should not throw error
      expect(() => {
        render(
          <Modal open={true} onClose={onClose}>
            <p>Just text, no interactive elements</p>
          </Modal>
        );
      }).not.toThrow();
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Keyboard navigation (Requirement 6.7)
  // ---------------------------------------------------------------------------
  describe('keyboard navigation', () => {
    it('closes modal with Escape key', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not close modal with other keys', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      await user.keyboard('{Enter}');
      await user.keyboard('{Space}');
      await user.keyboard('a');
      await user.keyboard('{ArrowDown}');
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('allows Tab navigation within modal', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <input type="text" placeholder="Name" />
          <input type="email" placeholder="Email" />
          <button>Submit</button>
        </Modal>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
      });
      
      // Tab to name input
      await user.tab();
      expect(screen.getByPlaceholderText('Name')).toHaveFocus();
      
      // Tab to email input
      await user.tab();
      expect(screen.getByPlaceholderText('Email')).toHaveFocus();
      
      // Tab to submit button
      await user.tab();
      expect(screen.getByRole('button', { name: 'Submit' })).toHaveFocus();
    });

    it('allows Shift+Tab navigation within modal', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <button>Action 1</button>
          <button>Action 2</button>
        </Modal>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
      });
      
      // Shift+Tab should go to last element
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Action 2' })).toHaveFocus();
      
      // Shift+Tab again
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Action 1' })).toHaveFocus();
    });

    it('activates close button with Enter key', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
      });
      
      await user.keyboard('{Enter}');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('activates close button with Space key', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
      });
      
      await user.keyboard(' ');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Screen reader support
  // ---------------------------------------------------------------------------
  describe('screen reader support', () => {
    it('announces modal with role="dialog"', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      // Screen readers will announce this as a dialog
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
    });

    it('provides accessible name via aria-labelledby', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Delete Confirmation">
          <p>Are you sure?</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog', { name: 'Delete Confirmation' });
      expect(dialog).toBeInTheDocument();
    });

    it('close button has accessible label', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      // Screen readers will announce "モーダルを閉じる button"
      const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
      expect(closeButton).toBeInTheDocument();
    });

    it('modal content is accessible to screen readers', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Information">
          <p>This is important information.</p>
          <button>Acknowledge</button>
        </Modal>
      );
      
      // All content should be accessible
      expect(screen.getByText('This is important information.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Acknowledge' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Semantic HTML
  // ---------------------------------------------------------------------------
  describe('semantic HTML', () => {
    it('uses heading element for title', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Modal Title">
          <p>Modal content</p>
        </Modal>
      );
      
      const heading = screen.getByRole('heading', { name: 'Modal Title' });
      expect(heading).toBeInTheDocument();
      expect(heading.tagName).toBe('H2');
    });

    it('uses button element for close button', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
      expect(closeButton.tagName).toBe('BUTTON');
      expect(closeButton).toHaveAttribute('type', 'button');
    });

    it('uses semantic structure for header, body, footer', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal
          open={true}
          onClose={onClose}
          title="Test Modal"
          footer={<button>Save</button>}
        >
          <p>Modal body content</p>
        </Modal>
      );
      
      // Check for semantic structure (using class names as proxy)
      const header = container.querySelector('[class*="header"]');
      const body = container.querySelector('[class*="body"]');
      const footer = container.querySelector('[class*="footer"]');
      
      expect(header).toBeInTheDocument();
      expect(body).toBeInTheDocument();
      expect(footer).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases for accessibility
  // ---------------------------------------------------------------------------
  describe('accessibility edge cases', () => {
    it('handles modal without title gracefully', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).not.toHaveAttribute('aria-labelledby');
    });

    it('handles empty modal content', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Empty Modal">
          {null}
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog', { name: 'Empty Modal' });
      expect(dialog).toBeInTheDocument();
    });

    it('handles modal with complex nested content', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Complex Modal">
          <div>
            <h3>Section 1</h3>
            <p>Content</p>
            <div>
              <button>Nested Button</button>
              <input type="text" aria-label="Nested Input" />
            </div>
          </div>
        </Modal>
      );
      
      // All nested elements should be accessible
      expect(screen.getByRole('heading', { name: 'Section 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nested Button' })).toBeInTheDocument();
      expect(screen.getByLabelText('Nested Input')).toBeInTheDocument();
    });
  });
});
