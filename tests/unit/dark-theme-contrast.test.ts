import { describe, it, expect } from 'vitest';

/**
 * WCAG AA Contrast Requirements:
 * - Normal text (< 18pt): 4.5:1
 * - Large text (>= 18pt or >= 14pt bold): 3:1
 * - UI components and graphical objects: 3:1
 */

// Helper function to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) throw new Error(`Invalid hex color: ${hex}`);
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

// Calculate relative luminance
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

describe('Feature: mobile-first-design - Dark Theme Color Contrast', () => {
  describe('Requirement 1.6: Dark theme color contrast', () => {
    it('primary text on dark background meets WCAG AA (4.5:1)', () => {
      const textColor = '#F1F5F9'; // --color-text-primary (dark)
      const bgColor = '#0F172A'; // --color-background (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('secondary text on dark background meets WCAG AA (4.5:1)', () => {
      const textColor = '#CBD5E1'; // --color-text-secondary (dark)
      const bgColor = '#0F172A'; // --color-background (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('primary text on surface meets WCAG AA (4.5:1)', () => {
      const textColor = '#F1F5F9'; // --color-text-primary (dark)
      const surfaceColor = '#1E293B'; // --color-surface (dark)
      const ratio = getContrastRatio(textColor, surfaceColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('primary button text on primary background meets WCAG AA (4.5:1)', () => {
      const textColor = '#0F172A'; // --color-on-primary (dark)
      const bgColor = '#4DA3FF'; // --color-primary (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('success button text on success background meets WCAG AA (4.5:1)', () => {
      const textColor = '#FFFFFF'; // --color-on-success (dark)
      const bgColor = '#047857'; // --color-success (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('danger button text on danger background meets WCAG AA (4.5:1)', () => {
      const textColor = '#0F172A'; // --color-on-danger (dark)
      const bgColor = '#F87171'; // --color-danger (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('warning button text on warning background meets WCAG AA (4.5:1)', () => {
      const textColor = '#0F172A'; // --color-on-warning (dark)
      const bgColor = '#FBB040'; // --color-warning (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('info button text on info background meets WCAG AA (4.5:1)', () => {
      const textColor = '#0F172A'; // --color-on-info (dark)
      const bgColor = '#60A5FA'; // --color-info (dark)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('Requirement 8.4: Border visibility in dark theme', () => {
    it('subtle border on surface is visible (meets 1.5:1 minimum)', () => {
      const borderColor = '#475569'; // --color-border-subtle (dark)
      const surfaceColor = '#1E293B'; // --color-surface (dark)
      const ratio = getContrastRatio(borderColor, surfaceColor);
      expect(ratio).toBeGreaterThanOrEqual(1.5);
    });

    it('strong border on surface meets 3:1 for UI components', () => {
      const borderColor = '#64748B'; // --color-border-strong (dark)
      const surfaceColor = '#1E293B'; // --color-surface (dark)
      const ratio = getContrastRatio(borderColor, surfaceColor);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });

    it('input border on surface meets 3:1 for UI components', () => {
      const borderColor = '#64748B'; // --color-border-input (dark)
      const surfaceColor = '#1E293B'; // --color-surface (dark)
      const ratio = getContrastRatio(borderColor, surfaceColor);
      expect(ratio).toBeGreaterThanOrEqual(3.0);
    });
  });

  describe('Light theme color contrast (baseline verification)', () => {
    it('primary text on light background meets WCAG AA (4.5:1)', () => {
      const textColor = '#0F172A'; // --color-text-primary (light)
      const bgColor = '#F7F9FC'; // --color-background (light)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('secondary text on light background meets WCAG AA (4.5:1)', () => {
      const textColor = '#64748B'; // --color-text-secondary (light)
      const bgColor = '#F7F9FC'; // --color-background (light)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });

    it('primary button text on primary background meets WCAG AA (4.5:1)', () => {
      const textColor = '#FFFFFF'; // --color-on-primary (light)
      const bgColor = '#1E6BFF'; // --color-primary (light)
      const ratio = getContrastRatio(textColor, bgColor);
      expect(ratio).toBeGreaterThanOrEqual(4.5);
    });
  });
});
