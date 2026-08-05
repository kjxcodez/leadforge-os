import type { AuthUser } from '../stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
}

export interface AuthResult {
  token: string;
  user: AuthUser;
}

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------

/**
 * AuthService is the single point of contact for all authentication IPC calls.
 * It does NOT manage state — callers (hooks/effects) update the stores.
 */
export const AuthService = {
  /**
   * Attempts to restore an existing session from the main process.
   * Returns null when no active token exists.
   */
  async restoreSession(): Promise<AuthResult | null> {
    try {
      const res = await window.ipc.invoke('auth:session', undefined);
      if (res && res.token && res.user) {
        return { token: res.token, user: res.user as AuthUser };
      }
      return null;
    } catch {
      return null;
    }
  },

  /**
   * Authenticates a user with email and password.
   * Throws on failure so callers can display errors.
   */
  async login(payload: LoginPayload): Promise<AuthResult> {
    const res = await window.ipc.invoke('auth:login', payload as any);
    if (!res || !res.token) {
      throw new Error('Authentication failed. Please check your credentials.');
    }
    return { token: res.token, user: res.user as AuthUser };
  },

  /**
   * Registers a new user account.
   * Throws on failure.
   */
  async register(payload: RegisterPayload): Promise<AuthResult> {
    const res = await window.ipc.invoke('auth:register', payload as any);
    if (!res || !res.token) {
      throw new Error('Registration failed. This email may already be in use.');
    }
    return { token: res.token, user: res.user as AuthUser };
  },

  /**
   * Signs the current user out and clears the token in main process memory.
   */
  async logout(): Promise<void> {
    await window.ipc.invoke('auth:logout', undefined);
  },

  async forgotPassword(email: string): Promise<void> {
    await window.ipc.invoke('auth:forgot-password', { email });
  },

  async resendVerificationEmail(email: string): Promise<void> {
    await window.ipc.invoke('auth:resend-verification', { email });
  }
};
