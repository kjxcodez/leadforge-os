import type { User, Session } from '@leadforge/schema';

export interface AuthSession extends Session {}
export interface AuthUser extends User {}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
}
