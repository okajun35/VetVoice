/**
 * Theme management utilities for VetVoice
 * Supports light, dark, and auto (system preference) themes
 */

export type Theme = 'light' | 'dark' | 'auto';

const THEME_STORAGE_KEY = 'vetvoice-theme';

/**
 * Get the current theme from localStorage
 * Returns 'auto' as default when localStorage is empty or unavailable
 */
export function getTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      return stored;
    }
  } catch (error) {
    console.warn('Failed to read theme from localStorage:', error);
  }
  return 'auto'; // Default fallback
}

/**
 * Set the theme and persist to localStorage
 */
export function setTheme(theme: Theme): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (error) {
    console.warn('Failed to save theme to localStorage:', error);
  }
}

/**
 * Get the system theme preference using prefers-color-scheme media query
 */
export function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Get the effective theme (resolves 'auto' to actual theme based on system preference)
 */
export function getEffectiveTheme(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') {
    return getSystemTheme();
  }
  return theme;
}
