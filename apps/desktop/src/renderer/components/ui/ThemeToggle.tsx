import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';

/**
 * ThemeToggle cycles between dark and light modes.
 * Reads current theme from UIStore via useTheme hook.
 */
export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  const handleToggle = () => {
    setTheme(isDark ? 'light' : 'dark');
  };

  return (
    <button
      onClick={handleToggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-sunken rounded transition-colors"
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}
