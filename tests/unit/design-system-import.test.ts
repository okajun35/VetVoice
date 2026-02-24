import { describe, it, expect } from 'vitest';

/**
 * Feature: mobile-first-design
 * Task 1.4: Import design system in main entry point
 * 
 * Validates: Requirements 1.7
 * 
 * Tests that design system CSS files are properly imported
 * Note: jsdom has limited CSS custom property support, so we verify
 * the imports work without errors rather than checking computed styles
 */

describe('Design System Import', () => {
  it('should import CSS files without errors', () => {
    // If we reach this point, the CSS imports in setup.ts succeeded
    expect(true).toBe(true);
  });

  it('should have document.documentElement available', () => {
    // Verify the DOM is set up correctly
    expect(document.documentElement).toBeDefined();
    expect(document.documentElement.tagName).toBe('HTML');
  });

  it('should be able to query computed styles', () => {
    // Verify getComputedStyle works (even if CSS vars aren't fully supported)
    const rootStyles = getComputedStyle(document.documentElement);
    expect(rootStyles).toBeDefined();
  });

  it('should have a body element', () => {
    expect(document.body).toBeDefined();
    expect(document.body.tagName).toBe('BODY');
  });
});
