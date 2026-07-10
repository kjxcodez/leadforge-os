import { useEffect } from 'react';
import { useUIStore } from '../stores/ui-store';

/**
 * ThemeApplier is a renderless component that reads the theme from UIStore
 * and synchronises it with the document root class.
 *
 * It lives inside AppProviders so it always has UIStore context.
 * Keeping this separate from ThemeToggle prevents re-renders of the whole tree.
 */
export function ThemeApplier() {
  const { state } = useUIStore();

  useEffect(() => {
    const root = document.documentElement;
    const resolved =
      state.theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : state.theme;

    root.classList.remove('dark', 'light');
    root.classList.add(resolved);
  }, [state.theme]);

  return null;
}
