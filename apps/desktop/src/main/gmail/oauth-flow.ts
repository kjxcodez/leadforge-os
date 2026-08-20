import { shell } from 'electron';
import { randomUUID } from 'crypto';
import http from 'http';
import { AppLogger } from '../lib/logger';
import { GoogleOAuthClient } from './google-client';
import type { TokenInfo } from './google-client';

export interface GmailOAuthFlowResult {
  ok: boolean;
  reason?: 'cancelled' | 'error' | 'timeout' | 'unconfigured' | 'no-code';
  error?: string;
  tokens?: {
    refreshToken: string;
    accessToken: string;
    tokenExpiresAt: string;
  };
  email?: string;
  googleAccountId?: string;
}

export interface GmailOAuthFlowOptions {
  clientId: string;
  clientSecret: string;
  /** Loopback port for the OAuth callback. Must be registered in Google Cloud Console. */
  redirectPort: number;
}

const DEFAULT_PORT = 48112;
const TIMEOUT_MS = 5 * 60 * 1000;
const LOOPBACK_HOST = '127.0.0.1';

let activeFlow = false;

/**
 * Runs the Gmail mailbox OAuth 2.0 flow entirely in the desktop app.
 *
 * Flow:
 *   1. Start a tiny HTTP server on `http://127.0.0.1:<port>`.
 *   2. Open a BrowserWindow pointed at Google's authorization URL (only the
 *      `gmail.send` scope, `access_type=offline`, `prompt=consent`).
 *   3. Google redirects to `http://127.0.0.1:<port>/oauth2callback?code=...`.
 *   4. The local server exchanges the code for refresh + access tokens.
 *
 * This is intentionally separate from Google *login* (Better Auth social
 * sign-in) — mailbox authorization only grants `gmail.send`.
 */
export async function performGmailOAuth(
  options: GmailOAuthFlowOptions
): Promise<GmailOAuthFlowResult> {
  const { clientId, clientSecret } = options;
  if (!clientId || !clientSecret) {
    return {
      ok: false,
      reason: 'unconfigured',
      error: 'Gmail OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to apps/desktop/.env.'
    };
  }

  const port = options.redirectPort || DEFAULT_PORT;
  const redirectUri = `http://${LOOPBACK_HOST}:${port}/oauth2callback`;

  if (activeFlow) {
    return { ok: false, reason: 'error', error: 'A Gmail connection flow is already in progress.' };
  }
  activeFlow = true;

  const oauth = new GoogleOAuthClient({ clientId, clientSecret, redirectUri });
  const state = randomUUID();

  let server: http.Server | null = null;
  let timeoutHandle: NodeJS.Timeout | null = null;
  let settled = false;

  const cleanup = () => {
    if (timeoutHandle) clearTimeout(timeoutHandle);
    try {
      server?.close();
    } catch {
      // already closed
    }
    activeFlow = false;
  };

  const settle = (result: GmailOAuthFlowResult) => {
    if (settled) return;
    settled = true;
    cleanup();
    // resolve outside of the current tick
    setImmediate(() => resolve(result));
  };

  let resolve!: (value: GmailOAuthFlowResult) => void;

  const promise = new Promise<GmailOAuthFlowResult>((res) => {
    resolve = res;
  });

  try {
    await new Promise<void>((resolveListen, rejectListen) => {
      server = http.createServer((req, res) => {
        void handleCallback(req, res);
      });

      server.once('error', (err: NodeJS.ErrnoException) => {
        rejectListen(
          new Error(
            `Cannot listen on ${redirectUri}: ${err.message}. Free the port or change GMAIL_REDIRECT_PORT.`
          )
        );
      });

      server.listen(port, LOOPBACK_HOST, () => {
        resolveListen();
      });
    });
  } catch (err) {
    activeFlow = false;
    return { ok: false, reason: 'error', error: (err as Error).message };
  }

  const handleCallback = (req: http.IncomingMessage, res: http.ServerResponse): void => {
    const url = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${port}`);
    if (url.pathname !== '/oauth2callback') {
      res.writeHead(404).end('Not found');
      return;
    }

    const errorParam = url.searchParams.get('error');
    const code = url.searchParams.get('code');
    const returnedState = url.searchParams.get('state');

    if (errorParam) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(successPage('Authorization failed', 'You can close this window.'));
      AppLogger.warn('gmail-oauth', `Gmail OAuth returned error: ${errorParam}`);
      settle({
        ok: false,
        reason: 'error',
        error: `Google returned an error: ${errorParam}`
      });
      return;
    }

    if (!code || returnedState !== state) {
      res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('Invalid OAuth callback (missing code or state mismatch).');
      settle({ ok: false, reason: 'no-code', error: 'OAuth callback was missing the authorization code.' });
      return;
    }

    // Exchange the code outside the request handler; respond immediately so the
    // BrowserWindow can finish loading a friendly page.
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(successPage('Gmail connected', 'You can close this window and return to LeadForge OS.'));

    void exchangeAndSettle(code);
  };

  const exchangeAndSettle = async (code: string): Promise<void> => {
    try {
      const tokenResponse = await oauth.exchangeCodeForTokens(code);
      if (!tokenResponse.refreshToken) {
        settle({
          ok: false,
          reason: 'error',
          error: 'Google did not return a refresh token. Please try again (consent was required).'
        });
        return;
      }

      let email = '';
      let googleAccountId: string | undefined;
      try {
        const info: TokenInfo = await oauth.getTokenInfo(tokenResponse.accessToken);
        email = info.email || '';
        googleAccountId = info.sub;
      } catch {
        // Email resolution is best-effort; fall back to the user-supplied field later.
      }

      const result: GmailOAuthFlowResult = {
        ok: true,
        email,
        tokens: {
          refreshToken: tokenResponse.refreshToken,
          accessToken: tokenResponse.accessToken,
          tokenExpiresAt: new Date(Date.now() + tokenResponse.expiresIn * 1000).toISOString()
        }
      };
      if (googleAccountId) result.googleAccountId = googleAccountId;
      settle(result);
    } catch (err) {
      AppLogger.error('gmail-oauth', 'Failed to exchange Gmail OAuth code', undefined, err as Error);
      settle({
        ok: false,
        reason: 'error',
        error: `Failed to complete Gmail authorization: ${(err as Error).message}`
      });
    }
  };

  // Open the Google authorization URL in the user's default browser
  // (typically Google Chrome). No Electron BrowserWindow is used, and no
  // Chrome cookies or profiles are accessed.
  void shell
    .openExternal(oauth.buildAuthUrl(state))
    .then(() => {
      // External browser launched successfully. The loopback server will
      // receive the redirect once the user completes authorization.
    })
    .catch((err) => {
      AppLogger.error(
        'gmail-oauth',
        'Failed to launch external browser for Google authorization',
        undefined,
        err
      );
      settle({
        ok: false,
        reason: 'error',
        error: 'Failed to open Google authorization in your browser.'
      });
    });

  timeoutHandle = setTimeout(() => {
    AppLogger.warn('gmail-oauth', 'Gmail OAuth window timed out');
    settle({ ok: false, reason: 'timeout', error: 'Gmail authorization timed out.' });
  }, TIMEOUT_MS);

  // If the user closes the browser tab without completing the flow, we still
  // need to surface a cancellation. We cannot observe the external browser
  // directly, so we let the loopback server time out and the timeout above
  // reports cancellation. To improve UX, also cancel if the user explicitly
  // aborts via the IPC `email-accounts:gmail:connect` UI button (handled by
  // a single activeFlow guard + a future `abort` signal).
  return promise;
}

function successPage(title: string, subtitle: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="background:#0A0A0B;color:#fff;font-family:system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;margin:0">
  <div style="text-align:center">
    <div style="font-size:2rem;margin-bottom:1rem">✅</div>
    <h2 style="margin:0 0 .5rem">${title}</h2>
    <p style="color:#9ca3af;margin:0">${subtitle}</p>
  </div>
</body>
</html>`;
}