import assert from 'assert';
import {
  createMailProvider,
  resolveProviderKind
} from '../mail';

/**
 * Self-contained test suite for the mail provider abstraction.
 * Verifies that the provider factory and account-kind resolution are correct
 * without performing any network I/O.
 */
export async function runMailProviderTests() {
  console.log('--- STARTING MAIL PROVIDER ABSTRACTION TESTS ---');

  // 1. resolveProviderKind: gmail_oauth accounts
  assert.strictEqual(
    resolveProviderKind({ provider: 'gmail_oauth', email: 'a@b.com' }),
    'gmail_oauth'
  );
  assert.strictEqual(
    resolveProviderKind({ provider: 'smtp', refreshToken: 'present' }),
    'gmail_oauth',
    'presence of refreshToken implies gmail_oauth'
  );
  assert.strictEqual(
    resolveProviderKind({ provider: 'gmail_smtp', email: 'a@b.com' }),
    'smtp',
    'legacy gmail_smtp is SMTP'
  );
  assert.strictEqual(resolveProviderKind(null), 'smtp');
  assert.strictEqual(resolveProviderKind(undefined), 'smtp');
  console.log('✅ resolveProviderKind resolution verified.');

  // 2. createMailProvider: gmail_oauth
  const gmailProvider = createMailProvider({
    kind: 'gmail_oauth',
    gmail: {
      user: 'user@gmail.com',
      clientId: 'client-id',
      clientSecret: 'client-secret',
      refreshToken: 'refresh-token'
    }
  });
  assert.strictEqual(gmailProvider.kind, 'gmail_oauth');
  console.log('✅ createMailProvider builds GmailMailProvider.');

  // 3. createMailProvider: smtp
  const smtpProvider = createMailProvider({
    kind: 'smtp',
    smtp: {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      username: 'user@gmail.com',
      password: 'app-password'
    }
  });
  assert.strictEqual(smtpProvider.kind, 'smtp');
  smtpProvider.close();
  console.log('✅ createMailProvider builds SmtpMailProvider.');

  // 4. createMailProvider: invalid resolution throws
  assert.throws(
    () => createMailProvider({ kind: 'gmail_oauth' } as any),
    /no valid transport configuration/
  );
  console.log('✅ createMailProvider rejects invalid resolution.');

  console.log('--- MAIL PROVIDER ABSTRACTION TESTS PASSED ---');
}

runMailProviderTests();
