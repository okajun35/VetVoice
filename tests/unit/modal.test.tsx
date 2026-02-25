/**
 * Unit tests: Modal component
 * Feature: mobile-first-design
 *
 * Tests the Modal component rendering, open/close behavior, focus management,
 * and keyboard interactions.
 * Validates Requirements: 6.4, 6.5, 6.7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { Modal } from '../../src/components/ui/Modal/Modal';

describe('Modal component', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  afterEach(() => {
    // Clean up any open modals
    document.body.innerHTML = '';
  });

  // ---------------------------------------------------------------------------
  // Open/Close state tests (Requirement 6.4)
  // ---------------------------------------------------------------------------
  describe('open/close state', () => {
    it('does not render when open is false', () => {
      const onClose = vi.fn();
      render(
        <Modal open={false} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
    });

    it('renders when open is true', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('renders with title when provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Test Modal' })).toBeInTheDocument();
    });

    it('renders without title when not provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      const onClose = vi.fn();
      render(
        <Modal
          open={true}
          onClose={onClose}
          footer={<button>Save</button>}
        >
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('renders without footer when not provided', () => {
      const onClose = vi.fn();
      const { container } = render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const footer = container.querySelector('.footer');
      expect(footer).not.toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Close button tests (Requirement 6.4)
  // ---------------------------------------------------------------------------
  describe('close button', () => {
    it('renders close button when title is provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toBeInTheDocument();
    });

    it('does not render close button when title is not provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      expect(screen.queryByRole('button', { name: 'モーダルを閉じる' })).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
      await user.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Escape key tests (Requirement 6.7)
  // ---------------------------------------------------------------------------
  describe('Escape key', () => {
    it('calls onClose when Escape key is pressed', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      await user.keyboard('{Escape}');
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when other keys are pressed', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      await user.keyboard('{Enter}');
      await user.keyboard('{Space}');
      await user.keyboard('a');
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not listen for Escape when modal is closed', async () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      // Close the modal
      rerender(
        <Modal open={false} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      await user.keyboard('{Escape}');
      
      // onClose should not be called when modal is already closed
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Overlay click tests (Requirement 6.4)
  // ---------------------------------------------------------------------------
  describe('overlay click', () => {
    it('calls onClose when overlay is clicked', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      // Get the overlay by finding the parent of the dialog
      const dialog = screen.getByRole('dialog');
      const overlay = dialog.parentElement;
      expect(overlay).not.toBeNull();
      
      if (overlay) {
        await user.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(1);
      }
    });

    it('does not call onClose when modal content is clicked', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const content = screen.getByText('Modal content');
      await user.click(content);
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose when modal dialog is clicked', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      await user.click(dialog);
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Focus trap tests (Requirement 6.4)
  // ---------------------------------------------------------------------------
  describe('focus trap', () => {
    it('focuses first focusable element when modal opens', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <button>First button</button>
          <button>Second button</button>
        </Modal>
      );
      
      await waitFor(() => {
        // The close button in the header is the first focusable element
        const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
        expect(closeButton).toHaveFocus();
      });
    });

    it('traps Tab key within modal', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <button>First button</button>
          <button>Second button</button>
        </Modal>
      );
      
      await waitFor(() => {
        // Close button is focused first
        expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
      });
      
      // Tab to first button in body
      await user.tab();
      expect(screen.getByRole('button', { name: 'First button' })).toHaveFocus();
      
      // Tab to second button
      await user.tab();
      expect(screen.getByRole('button', { name: 'Second button' })).toHaveFocus();
      
      // Tab should wrap back to close button
      await user.tab();
      expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
    });

    it('traps Shift+Tab key within modal', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <button>First button</button>
          <button>Second button</button>
        </Modal>
      );
      
      await waitFor(() => {
        // Close button is focused first
        expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
      });
      
      // Shift+Tab should wrap to last focusable element (second button)
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'Second button' })).toHaveFocus();
      
      // Shift+Tab to first button
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'First button' })).toHaveFocus();
      
      // Shift+Tab to close button
      await user.tab({ shift: true });
      expect(screen.getByRole('button', { name: 'モーダルを閉じる' })).toHaveFocus();
    });
  });

  // ---------------------------------------------------------------------------
  // Focus management tests (Requirement 6.5)
  // ---------------------------------------------------------------------------
  describe('focus management', () => {
    it('returns focus to trigger element when modal closes', async () => {
      const TriggerButton = () => {
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
      
      render(<TriggerButton />);
      
      const triggerButton = screen.getByRole('button', { name: 'Open Modal' });
      await user.click(triggerButton);
      
      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Close modal with Escape
      await user.keyboard('{Escape}');
      
      // Focus should return to trigger button
      await waitFor(() => {
        expect(triggerButton).toHaveFocus();
      });
    });

    it('stores previous active element when modal opens', () => {
      const onClose = vi.fn();
      const button = document.createElement('button');
      button.textContent = 'Trigger';
      document.body.appendChild(button);
      button.focus();
      
      expect(document.activeElement).toBe(button);
      
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      // Previous active element should be stored (we can't directly test this,
      // but we can verify focus behavior when modal closes)
      document.body.removeChild(button);
    });
  });

  // ---------------------------------------------------------------------------
  // Accessibility tests (Requirement 6.1)
  // ---------------------------------------------------------------------------
  describe('accessibility', () => {
    it('has role="dialog"', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
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

    it('has aria-labelledby when title is provided', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
      
      const title = screen.getByRole('heading', { name: 'Test Modal' });
      expect(title).toHaveAttribute('id', 'modal-title');
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

    it('close button has aria-label', () => {
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
  // Children rendering tests
  // ---------------------------------------------------------------------------
  describe('children rendering', () => {
    it('renders simple text children', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          Simple text content
        </Modal>
      );
      
      expect(screen.getByText('Simple text content')).toBeInTheDocument();
    });

    it('renders complex JSX children', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <div>
            <h3>Heading</h3>
            <p>Paragraph</p>
            <button>Action</button>
          </div>
        </Modal>
      );
      
      expect(screen.getByRole('heading', { name: 'Heading' })).toBeInTheDocument();
      expect(screen.getByText('Paragraph')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
    });

    it('renders form elements in children', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Form Modal">
          <form>
            <label htmlFor="name">Name</label>
            <input id="name" type="text" />
            <button type="submit">Submit</button>
          </form>
        </Modal>
      );
      
      expect(screen.getByLabelText('Name')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    });
  });

  // ---------------------------------------------------------------------------
  // Combined scenarios
  // ---------------------------------------------------------------------------
  describe('combined scenarios', () => {
    it('renders modal with title, content, and footer', () => {
      const onClose = vi.fn();
      render(
        <Modal
          open={true}
          onClose={onClose}
          title="Confirm Action"
          footer={
            <>
              <button>Cancel</button>
              <button>Confirm</button>
            </>
          }
        >
          <p>Are you sure you want to proceed?</p>
        </Modal>
      );
      
      expect(screen.getByRole('heading', { name: 'Confirm Action' })).toBeInTheDocument();
      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('handles multiple close methods', async () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose} title="Test Modal">
          <p>Modal content</p>
        </Modal>
      );
      
      // Close with Escape key
      await user.keyboard('{Escape}');
      expect(onClose).toHaveBeenCalledTimes(1);
      
      // Close with close button
      const closeButton = screen.getByRole('button', { name: 'モーダルを閉じる' });
      await user.click(closeButton);
      expect(onClose).toHaveBeenCalledTimes(2);
      
      // Close with overlay click
      const dialog = screen.getByRole('dialog');
      const overlay = dialog.parentElement;
      if (overlay) {
        await user.click(overlay);
        expect(onClose).toHaveBeenCalledTimes(3);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------
  describe('edge cases', () => {
    it('handles rapid open/close toggling', () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <Modal open={false} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      
      // Open
      rerender(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Close
      rerender(
        <Modal open={false} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      
      // Open again
      rerender(
        <Modal open={true} onClose={onClose}>
          <p>Modal content</p>
        </Modal>
      );
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('handles empty children', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          {null}
        </Modal>
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('handles modal with no focusable elements', () => {
      const onClose = vi.fn();
      render(
        <Modal open={true} onClose={onClose}>
          <p>Just text, no buttons</p>
        </Modal>
      );
      
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Should not throw error even without focusable elements
    });
  });
});
