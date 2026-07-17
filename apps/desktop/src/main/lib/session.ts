import { app, safeStorage } from 'electron';
import fs from 'fs';
import { join } from 'path';
import { AppLogger } from './logger';

export interface SessionData {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: string | null;
  userId?: string | null;
  activeWorkspaceId?: string | null;
  user?: any;
}

function getSessionPath(): string {
  return join(app.getPath('userData'), 'session.dat');
}

export function saveSession(session: SessionData): void {
  try {
    if (!safeStorage.isEncryptionAvailable()) {
      AppLogger.warn('auth', 'Encryption not available, session NOT saved to disk.');
      return;
    }
    const sessionStr = JSON.stringify(session);
    const encrypted = safeStorage.encryptString(sessionStr);
    fs.writeFileSync(getSessionPath(), encrypted);
    AppLogger.info('auth', 'Credential encrypted');
  } catch (err) {
    AppLogger.error('auth', 'Failed to encrypt and save session', undefined, err);
  }
}

export function loadSession(): SessionData | null {
  try {
    const sessionPath = getSessionPath();
    if (!fs.existsSync(sessionPath)) {
      return null;
    }
    if (!safeStorage.isEncryptionAvailable()) {
      AppLogger.warn('auth', 'Encryption not available, cannot read session.');
      return null;
    }
    const encrypted = fs.readFileSync(sessionPath);
    const decryptedStr = safeStorage.decryptString(encrypted);
    AppLogger.info('auth', 'Credential decrypted');
    return JSON.parse(decryptedStr) as SessionData;
  } catch (err) {
    AppLogger.error('auth', 'Failed to decrypt session, clearing file', undefined, err);
    clearSession();
    return null;
  }
}

export function clearSession(): void {
  try {
    const sessionPath = getSessionPath();
    if (fs.existsSync(sessionPath)) {
      fs.unlinkSync(sessionPath);
      AppLogger.info('auth', 'Credential removed');
    }
  } catch (err) {
    AppLogger.error('auth', 'Failed to delete session file', undefined, err);
  }
}
