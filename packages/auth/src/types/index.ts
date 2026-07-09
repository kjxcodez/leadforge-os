import type { User, Session } from '@leadforge/types';

export interface AuthSession extends Session {}
export interface AuthUser extends User {}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
}
