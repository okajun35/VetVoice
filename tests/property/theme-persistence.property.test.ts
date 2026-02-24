/**
 * Property-based tests for theme persistence
 * Feature: mobile-first-design
 */

import { describe, it, expect, beforeEach } from 'vitest';
import fc from 'fast-check';
import { getTheme, setTheme, type Theme } from '@/lib/theme';

describe('Feature: mobile-first-design, Property 13: Theme persistence round-trip', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  it('**Validates: Requirements 8.3** - theme round-trip preserves value', () => {
    fc.assert(
      fc.property(fc.constantFrom<Theme>('light', 'dark', 'auto'), (theme) => {
        // Set the theme
        setTheme(theme);
        
        // Retrieve the theme
        const retrieved = getTheme();
        
        // The retrieved theme should match the set theme
        expect(retrieved).toBe(theme);
      }),
      { numRuns: 100 }
    );
  });

  it('**Validates: Requirements 8.3** - multiple theme changes preserve last value', () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom<Theme>('light', 'dark', 'auto'), { minLength: 1, maxLength: 10 }),
        (themes) => {
          // Apply multiple theme changes
          themes.forEach((theme) => setTheme(theme));
          
          // The retrieved theme should match the last theme set
          const lastTheme = themes[themes.length - 1];
          const retrieved = getTheme();
          
          expect(retrieved).toBe(lastTheme);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('**Validates: Requirements 8.3** - theme persists across getTheme calls', () => {
    fc.assert(
      fc.property(fc.constantFrom<Theme>('light', 'dark', 'auto'), (theme) => {
        // Set the theme
        setTheme(theme);
        
        // Call getTheme multiple times
        const first = getTheme();
        const second = getTheme();
        const third = getTheme();
        
        // All calls should return the same theme
        expect(first).toBe(theme);
        expect(second).toBe(theme);
        expect(third).toBe(theme);
      }),
      { numRuns: 100 }
    );
  });
});
