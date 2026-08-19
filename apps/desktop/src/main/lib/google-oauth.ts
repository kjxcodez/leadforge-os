import { BrowserWindow, shell } from 'electron';
import { AppLogger } from './logger';

export interface GoogleOAuthResult {
  ok: boolean;
  reason?: 'cancelled' | 'error' | 'timeout' | 'no-token';
  error?: string;
  token?: string;
}

interface GoogleOAuthOptions {
  apiUrl: string;
}

const TIMEOUT_MS = 5 * 60 * 1000;

interface InitiateResponse {
  url?: string;
  redirect?: boolean | string;
  authorizationUrl?: string;
  authorizeUrl?: string;
}

function extractAuthorizationUrl(headers: Headers, payload: InitiateResponse | null): string | null {
  const locationHeader = headers.get('location') || headers.get('Location');
  if (locationHeader && /^https?:\/\//i.test(locationHeader)) {
    return locationHeader;
  }
  if (payload) {
    const candidate = payload.url || payload.authorizationUrl || payload.authorizeUrl;
    if (candidate && typeof candidate === 'string' && /^https?:\/\//i.test(candidate)) {
      return candidate;
    }
    if (payload.redirect && typeof payload.redirect === 'string' && /^https?:\/\//i.test(payload.redirect)) {
      return payload.redirect;
    }
  }
  return null;
}

/**
 * Opens a system-managed Google OAuth window and waits for Better Auth
 * to complete the social sign-in flow.
 *
 * Better Auth's social sign-in endpoint is POST-only, so we first call
 * it from the main process to obtain the Google authorization URL,
 * then navigate the BrowserWindow to that URL. After Google redirects
 * back to Better Auth's callback, the Bearer plugin exposes the raw
 * session token via a `set-auth-token` response header which we
 * intercept from the BrowserWindow's webRequest events.
 */
export async function performGoogleOAuth(options: GoogleOAuthOptions): Promise<GoogleOAuthResult> {
  const { apiUrl } = options;

  const apiOrigin = (() => {
    try {
      return new URL(apiUrl).origin;
    } catch {
      return apiUrl;
    }
  })();

  const SIGNIN_PATH = '/api/v1/auth/sign-in/social';

  const callbackUrl = `${apiOrigin}/api/v1/auth/session`;

  let authorizationUrl: string | null = null;
  try {
    const initResponse = await fetch(`${apiOrigin}${SIGNIN_PATH}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        provider: 'google',
        callbackURL: callbackUrl
      })
    });

    if (!initResponse.ok) {
      const errorText = await initResponse.text().catch(() => '');
      AppLogger.error('auth', `Google OAuth initiate failed: ${initResponse.status} ${errorText}`);
      return {
        ok: false,
        reason: 'error',
        error: `Failed to start Google sign-in (HTTP ${initResponse.status})`
      };
    }

    const initResult = (await initResponse.json().catch(() => null)) as InitiateResponse | null;
    authorizationUrl = extractAuthorizationUrl(initResponse.headers, initResult);
  } catch (err) {
    AppLogger.error('auth', 'Failed to initiate Google OAuth flow', undefined, err as Error);
    return {
      ok: false,
      reason: 'error',
      error: 'Failed to start Google sign-in'
    };
  }

  if (!authorizationUrl) {
    return {
      ok: false,
      reason: 'error',
      error: 'Google sign-in did not return an authorization URL'
    };
  }

  return new Promise<GoogleOAuthResult>((resolve) => {
    let resolved = false;
    let capturedToken: string | null = null;
    let timeoutHandle: NodeJS.Timeout | null = null;
    let oauthSession: Electron.Session | null = null;

    const cleanup = (result: GoogleOAuthResult) => {
      if (resolved) return;
      resolved = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      if (oauthSession) {
        try {
          oauthSession.webRequest.onHeadersReceived(null);
        } catch {
          // listener may already be detached
        }
      }
      if (authWindow && !authWindow.isDestroyed()) {
        authWindow.removeAllListeners('closed');
        authWindow.close();
      }
      resolve(result);
    };

    const authWindow = new BrowserWindow({
      width: 600,
      height: 720,
      show: true,
      title: 'Sign in with Google',
      backgroundColor: '#0A0A0B',
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true
      }
    });

    oauthSession = authWindow.webContents.session;

    oauthSession.webRequest.onHeadersReceived((details, callback) => {
      try {
        if (details.url.startsWith(apiOrigin) && !resolved) {
          const headerValue = details.responseHeaders?.['set-auth-token'];
          if (headerValue) {
            const token = Array.isArray(headerValue) ? headerValue[0] : headerValue;
            if (token && typeof token === 'string' && token.includes('.')) {
              capturedToken = token;
            }
          }
        }
      } catch {
        // ignore header access errors
      }
      callback({});
    });

    authWindow.webContents.on('did-navigate', (_event, url, _httpCode) => {
      try {
        const parsed = new URL(url);
        if (parsed.origin !== apiOrigin) return;
        const errorParam = parsed.searchParams.get('error');
        if (errorParam) {
          AppLogger.warn('auth', `Google OAuth returned error: ${errorParam}`);
          cleanup({ ok: false, reason: 'error', error: errorParam });
          return;
        }
        if (capturedToken && !url.includes('/sign-in/') && !url.includes('/callback/')) {
          cleanup({ ok: true, token: capturedToken });
          return;
        }
      } catch {
        // ignore
      }
    });

    authWindow.webContents.on('did-finish-load', () => {
      if (resolved) return;
      if (capturedToken) {
        cleanup({ ok: true, token: capturedToken });
      }
    });

    authWindow.on('closed', () => {
      cleanup({ ok: false, reason: 'cancelled' });
    });

    authWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        void shell.openExternal(url);
      }
      return { action: 'deny' };
    });

    authWindow.webContents.on('render-process-gone', (_event, details) => {
      AppLogger.error('auth', `OAuth window renderer gone: ${details.reason}`);
      cleanup({ ok: false, reason: 'error', error: 'Browser window closed unexpectedly' });
    });

    timeoutHandle = setTimeout(() => {
      AppLogger.warn('auth', 'Google OAuth window timed out');
      cleanup({ ok: false, reason: 'timeout' });
    }, TIMEOUT_MS);

    void authWindow.loadURL(authorizationUrl!).catch((err) => {
      AppLogger.error('auth', 'Failed to load Google OAuth URL', undefined, err);
      cleanup({ ok: false, reason: 'error', error: 'Failed to open authentication window' });
    });
  });
}
