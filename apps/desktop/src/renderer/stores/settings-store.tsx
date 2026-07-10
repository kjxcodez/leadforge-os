import React, { createContext, useCallback, useContext, useReducer } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsState {
  notifications: boolean;
  autoLogin: boolean;
  compactMode: boolean;
  dateFormat: string;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type SettingsAction =
  | { type: 'TOGGLE_NOTIFICATIONS' }
  | { type: 'TOGGLE_AUTO_LOGIN' }
  | { type: 'TOGGLE_COMPACT_MODE' }
  | { type: 'SET_DATE_FORMAT'; payload: string }
  | { type: 'SETTINGS_RESET' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function loadSettings(): SettingsState {
  try {
    const raw = localStorage.getItem('lf:settings');
    if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {}
  return defaultSettings;
}

const defaultSettings: SettingsState = {
  notifications: true,
  autoLogin: true,
  compactMode: false,
  dateFormat: 'MMM d, yyyy',
};

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
  let next: SettingsState;
  switch (action.type) {
    case 'TOGGLE_NOTIFICATIONS':
      next = { ...state, notifications: !state.notifications };
      break;
    case 'TOGGLE_AUTO_LOGIN':
      next = { ...state, autoLogin: !state.autoLogin };
      break;
    case 'TOGGLE_COMPACT_MODE':
      next = { ...state, compactMode: !state.compactMode };
      break;
    case 'SET_DATE_FORMAT':
      next = { ...state, dateFormat: action.payload };
      break;
    case 'SETTINGS_RESET':
      next = defaultSettings;
      break;
    default:
      return state;
  }
  try { localStorage.setItem('lf:settings', JSON.stringify(next)); } catch {}
  return next;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SettingsContextValue {
  state: SettingsState;
  toggleNotifications: () => void;
  toggleAutoLogin: () => void;
  toggleCompactMode: () => void;
  setDateFormat: (fmt: string) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * SettingsProvider manages user preferences that persist across sessions.
 * All settings are stored in localStorage and restored on startup.
 */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(settingsReducer, undefined, loadSettings);

  const toggleNotifications = useCallback(() => dispatch({ type: 'TOGGLE_NOTIFICATIONS' }), []);
  const toggleAutoLogin = useCallback(() => dispatch({ type: 'TOGGLE_AUTO_LOGIN' }), []);
  const toggleCompactMode = useCallback(() => dispatch({ type: 'TOGGLE_COMPACT_MODE' }), []);
  const setDateFormat = useCallback((fmt: string) => dispatch({ type: 'SET_DATE_FORMAT', payload: fmt }), []);
  const resetSettings = useCallback(() => dispatch({ type: 'SETTINGS_RESET' }), []);

  return (
    <SettingsContext.Provider value={{ state, toggleNotifications, toggleAutoLogin, toggleCompactMode, setDateFormat, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useSettingsStore provides access to persisted user settings.
 * Must be used inside SettingsProvider.
 */
export function useSettingsStore(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettingsStore must be used within SettingsProvider');
  return ctx;
}
