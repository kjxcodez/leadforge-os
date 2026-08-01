import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

/**
 * Returns a 32-byte hash buffer derived from the ENCRYPTION_KEY environment variable.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || 'leadforge-default-dev-encryption-key-32b';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Returns a serialized JSON string containing ciphertext, iv, and auth tag.
 */
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return JSON.stringify({
    ciphertext: encrypted,
    iv: iv.toString('hex'),
    tag: authTag
  });
}

/**
 * Decrypts a GCM payload string back to plaintext.
 */
export function decrypt(encryptedJson: string): string {
  const { ciphertext, iv, tag } = JSON.parse(encryptedJson);
  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));

  let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
