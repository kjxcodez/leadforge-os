import { useEffect } from 'react';
import { useUIStore, type Theme } from '../stores/ui-store';

/**
 * useTheme provides theme state and the setTheme action.
 * It also applies the theme class to the document root whenever it changes.
 */
export function useTheme() {
  const { state, setTheme } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;
    const resolved = state.theme === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : state.theme;

    root.classList.remove('dark', 'light');
    root.classList.add(resolved);
  }, [state.theme]);

  return {
    theme: state.theme,
    setTheme: (t: Theme) => setTheme(t),
    isDark: state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches),
  };
}
