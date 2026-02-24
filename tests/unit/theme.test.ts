/**
 * Unit tests for theme utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTheme, setTheme, getSystemTheme, getEffectiveTheme } from '@/lib/theme';

describe('Theme utilities', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Clear any mocks
    vi.clearAllMocks();
  });

  describe('getTheme', () => {
    it('returns "auto" as default when localStorage is empty', () => {
      const theme = getTheme();
      expect(theme).toBe('auto');
    });

    it('returns stored theme when localStorage has valid value', () => {
      localStorage.setItem('vetvoice-theme', 'light');
      expect(getTheme()).toBe('light');

      localStorage.setItem('vetvoice-theme', 'dark');
      expect(getTheme()).toBe('dark');

      localStorage.setItem('vetvoice-theme', 'auto');
      expect(getTheme()).toBe('auto');
    });

    it('returns "auto" when localStorage has invalid value', () => {
      localStorage.setItem('vetvoice-theme', 'invalid');
      expect(getTheme()).toBe('auto');
    });

    it('returns "auto" when localStorage throws error', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      const theme = getTheme();
      expect(theme).toBe('auto');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to read theme from localStorage:',
        expect.any(Error)
      );

      getItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('setTheme', () => {
    it('persists theme to localStorage', () => {
      setTheme('light');
      expect(localStorage.getItem('vetvoice-theme')).toBe('light');

      setTheme('dark');
      expect(localStorage.getItem('vetvoice-theme')).toBe('dark');

      setTheme('auto');
      expect(localStorage.getItem('vetvoice-theme')).toBe('auto');
    });

    it('handles localStorage errors gracefully', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });

      // Should not throw
      expect(() => setTheme('light')).not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Failed to save theme to localStorage:',
        expect.any(Error)
      );

      setItemSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('getSystemTheme', () => {
    it('detects dark system preference', () => {
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      expect(getSystemTheme()).toBe('dark');

      matchMediaSpy.mockRestore();
    });

    it('detects light system preference', () => {
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      expect(getSystemTheme()).toBe('light');

      matchMediaSpy.mockRestore();
    });
  });

  describe('getEffectiveTheme', () => {
    it('returns light when theme is light', () => {
      expect(getEffectiveTheme('light')).toBe('light');
    });

    it('returns dark when theme is dark', () => {
      expect(getEffectiveTheme('dark')).toBe('dark');
    });

    it('resolves auto mode to system preference (dark)', () => {
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: true,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      expect(getEffectiveTheme('auto')).toBe('dark');

      matchMediaSpy.mockRestore();
    });

    it('resolves auto mode to system preference (light)', () => {
      const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      });

      expect(getEffectiveTheme('auto')).toBe('light');

      matchMediaSpy.mockRestore();
    });
  });
});
