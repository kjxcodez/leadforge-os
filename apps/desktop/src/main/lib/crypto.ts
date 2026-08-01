import { AppLogger } from './logger';

// Dynamically load Electron safeStorage to support CLI/test environments
let safeStorage: any;
try {
  safeStorage = require('electron').safeStorage;
} catch {
  // safeStorage is unavailable outside of Electron (e.g. testing)
}

/**
 * Encrypts a sensitive string credential using Electron safeStorage.
 * Prefixes the output with '_enc_base64:' to mark it as encrypted.
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    AppLogger.warn(
      'security',
      'Electron safeStorage encryption is not available. Saving secret in plain text.'
    );
    return plainText;
  }
  try {
    const buffer = safeStorage.encryptString(plainText);
    return `_enc_base64:${buffer.toString('base64')}`;
  } catch (err) {
    AppLogger.error(
      'security',
      'Electron safeStorage encryption failed. Saving secret in plain text.',
      undefined,
      err
    );
    return plainText;
  }
}

/**
 * Decrypts a sensitive string credential using Electron safeStorage.
 * Falls back to plain text if the credential is not marked as encrypted.
 */
export function decryptSecret(encryptedOrPlain: string): string {
  if (!encryptedOrPlain) return '';
  if (!encryptedOrPlain.startsWith('_enc_base64:')) {
    return encryptedOrPlain; // plain text fallback
  }
  if (!safeStorage || !safeStorage.isEncryptionAvailable()) {
    AppLogger.warn(
      'security',
      'Electron safeStorage decryption requested but encryption is not available.'
    );
    return '';
  }
  try {
    const base64Data = encryptedOrPlain.substring('_enc_base64:'.length);
    const buffer = Buffer.from(base64Data, 'base64');
    return safeStorage.decryptString(buffer);
  } catch (err) {
    AppLogger.error('security', 'Electron safeStorage decryption failed.', undefined, err);
    return '';
  }
}
