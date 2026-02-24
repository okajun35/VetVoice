/**
 * useTheme hook for managing theme state and applying it to the document
 */

import { useEffect, useState } from 'react';
import { getTheme, setTheme as persistTheme, getEffectiveTheme, type Theme } from '../lib/theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    const root = document.documentElement;
    const effectiveTheme = getEffectiveTheme(theme);
    root.setAttribute('data-theme', effectiveTheme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    persistTheme(newTheme);
    setThemeState(newTheme);
  };

  return { theme, setTheme };
}
