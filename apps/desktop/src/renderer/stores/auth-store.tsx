import React, { createContext, useCallback, useContext, useReducer } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  displayName?: string;
  role?: string;
  activeWorkspaceId?: string;
  emailVerified?: boolean;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  token: string | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type AuthAction =
  | { type: 'AUTH_LOADING' }
  | { type: 'AUTH_SUCCESS'; payload: { user: AuthUser; token: string } }
  | { type: 'AUTH_FAILURE'; payload: { error: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

const initialState: AuthState = {
  status: 'idle',
  user: null,
  token: null,
  error: null
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'AUTH_LOADING':
      return { ...state, status: 'loading', error: null };
    case 'AUTH_SUCCESS':
      return {
        ...state,
        status: 'authenticated',
        user: action.payload.user,
        token: action.payload.token,
        error: null
      };
    case 'AUTH_FAILURE':
      return {
        ...state,
        status: 'unauthenticated',
        user: null,
        token: null,
        error: action.payload.error
      };
    case 'AUTH_LOGOUT':
      return { ...initialState, status: 'unauthenticated' };
    case 'AUTH_CLEAR_ERROR':
      return { ...state, error: null };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface AuthContextValue {
  state: AuthState;
  setLoading: () => void;
  setAuthenticated: (user: AuthUser, token: string) => void;
  setUnauthenticated: (error?: string) => void;
  setLoggedOut: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/**
 * AuthProvider exposes global authentication state to the entire app tree.
 * It only manages state — services handle the actual IPC communication.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const setLoading = useCallback(() => dispatch({ type: 'AUTH_LOADING' }), []);

  const setAuthenticated = useCallback((user: AuthUser, token: string) => {
    dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
  }, []);

  const setUnauthenticated = useCallback((error?: string) => {
    dispatch({
      type: 'AUTH_FAILURE',
      payload: { error: error ?? 'Not authenticated' }
    });
  }, []);

  const setLoggedOut = useCallback(() => dispatch({ type: 'AUTH_LOGOUT' }), []);
  const clearError = useCallback(() => dispatch({ type: 'AUTH_CLEAR_ERROR' }), []);

  return (
    <AuthContext.Provider
      value={{ state, setLoading, setAuthenticated, setUnauthenticated, setLoggedOut, clearError }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useAuthStore gives components access to authentication state and actions.
 * Must be used inside AuthProvider.
 */
export function useAuthStore(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthStore must be used within AuthProvider');
  return ctx;
}
