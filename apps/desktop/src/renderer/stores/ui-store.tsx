import React, { createContext, useCallback, useContext, useReducer } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Theme = 'dark' | 'light' | 'system';

export interface UIState {
  theme: Theme;
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type UIAction =
  | { type: 'SET_THEME'; payload: Theme }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_SIDEBAR'; payload: boolean }
  | { type: 'TOGGLE_COMMAND_PALETTE' }
  | { type: 'CLOSE_COMMAND_PALETTE' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function getInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem('lf:theme') as Theme | null;
    if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  } catch {}
  return 'dark';
}

function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarCollapsed: !state.sidebarCollapsed };
    case 'SET_SIDEBAR':
      return { ...state, sidebarCollapsed: action.payload };
    case 'TOGGLE_COMMAND_PALETTE':
      return { ...state, commandPaletteOpen: !state.commandPaletteOpen };
    case 'CLOSE_COMMAND_PALETTE':
      return { ...state, commandPaletteOpen: false };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface UIContextValue {
  state: UIState;
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  setSidebar: (collapsed: boolean) => void;
  toggleCommandPalette: () => void;
  closeCommandPalette: () => void;
}

const UIContext = createContext<UIContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * UIProvider manages application-wide UI state: theme, sidebar, command palette.
 * Persists theme to localStorage so it survives restarts.
 */
export function UIProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, {
    theme: getInitialTheme(),
    sidebarCollapsed: false,
    commandPaletteOpen: false,
  });

  const setTheme = useCallback((theme: Theme) => {
    try { localStorage.setItem('lf:theme', theme); } catch {}
    dispatch({ type: 'SET_THEME', payload: theme });
  }, []);

  const toggleSidebar = useCallback(() => dispatch({ type: 'TOGGLE_SIDEBAR' }), []);
  const setSidebar = useCallback((collapsed: boolean) => dispatch({ type: 'SET_SIDEBAR', payload: collapsed }), []);
  const toggleCommandPalette = useCallback(() => dispatch({ type: 'TOGGLE_COMMAND_PALETTE' }), []);
  const closeCommandPalette = useCallback(() => dispatch({ type: 'CLOSE_COMMAND_PALETTE' }), []);

  return (
    <UIContext.Provider value={{ state, setTheme, toggleSidebar, setSidebar, toggleCommandPalette, closeCommandPalette }}>
      {children}
    </UIContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useUIStore provides access to UI presentation state and actions.
 * Must be used inside UIProvider.
 */
export function useUIStore(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUIStore must be used within UIProvider');
  return ctx;
}
