/**
 * ThemeSwitcher component for switching between light, dark, and auto themes
 */

import { useTheme } from '../hooks/useTheme';
import { Button } from './ui/Button/Button';
import type { Theme } from '../lib/theme';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <span style={{ marginRight: '0.5rem' }}>THEME:</span>
      <Button
        variant={theme === 'light' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => handleThemeChange('light')}
        aria-pressed={theme === 'light'}
      >
        LIGHT
      </Button>
      <Button
        variant={theme === 'dark' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => handleThemeChange('dark')}
        aria-pressed={theme === 'dark'}
      >
        DARK
      </Button>
      <Button
        variant={theme === 'auto' ? 'primary' : 'ghost'}
        size="sm"
        onClick={() => handleThemeChange('auto')}
        aria-pressed={theme === 'auto'}
      >
        AUTO
      </Button>
    </div>
  );
}
