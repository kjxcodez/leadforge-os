import type { User } from '../entities/user.js';
import type { Session } from '../entities/session.js';

export interface AuthSession extends Session {}
export interface AuthUser extends User {}

export interface AuthState {
  session: AuthSession | null;
  user: AuthUser | null;
}
