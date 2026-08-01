import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';
import { saveSession, loadSession, clearSession } from '../lib/session';
import { AppLogger } from '../lib/logger';

/**
 * Registers authentication and API test IPC channels.
 */
export function registerAuthIpc(
  sdk: SdkClient,
  setToken: (token: string | null) => void,
  setWorkspaceHeader: (workspaceId: string | null) => void,
  persistActiveWorkspace: (workspaceId: string | null) => void,
  getPersistedActiveWorkspace: () => string | null
) {
  safeRegister('auth:login', async (_event, payload) => {
    console.log('Main Process: Logging in user:', payload.email);
    const res = await sdk.auth.login(payload);
    setToken(res.token);

    const savedWorkspaceId = getPersistedActiveWorkspace();
    const workspaceId = savedWorkspaceId || res.user?.activeWorkspaceId;
    if (workspaceId) {
      setWorkspaceHeader(workspaceId);
    }

    try {
      saveSession({
        accessToken: res.token,
        userId: res.user?.id,
        activeWorkspaceId: workspaceId || null,
        user: res.user,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (err) {
      AppLogger.error('auth', 'Failed to save session on login', undefined, err);
    }

    return res;
  });

  safeRegister('auth:register', async (_event, payload) => {
    console.log('Main Process: Registering user:', payload.email);
    const res = await sdk.auth.register(payload);
    setToken(res.token);

    const savedWorkspaceId = getPersistedActiveWorkspace();
    const workspaceId = savedWorkspaceId || res.user?.activeWorkspaceId;
    if (workspaceId) {
      setWorkspaceHeader(workspaceId);
    }

    try {
      saveSession({
        accessToken: res.token,
        userId: res.user?.id,
        activeWorkspaceId: workspaceId || null,
        user: res.user,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      });
    } catch (err) {
      AppLogger.error('auth', 'Failed to save session on register', undefined, err);
    }

    return res;
  });

  safeRegister('auth:logout', async () => {
    console.log('Main Process: Logging out user');
    try {
      await sdk.auth.logout();
    } catch (err) {
      console.warn('Backend session logout failed, clearing local headers anyway:', err);
    }
    setToken(null);
    setWorkspaceHeader(null);
    clearSession();
    persistActiveWorkspace(null);
    AppLogger.info('auth', 'Logout completed');
  });

  safeRegister('auth:session', async () => {
    try {
      AppLogger.info('auth', 'Session validation');
      const res = await sdk.auth.session();
      if (res && res.token && res.user) {
        // Online and session is valid! Save/update the session.dat.
        const savedWorkspaceId = getPersistedActiveWorkspace();
        const workspaceId = savedWorkspaceId || res.user.activeWorkspaceId;
        if (workspaceId) {
          setWorkspaceHeader(workspaceId);
        }
        setToken(res.token);

        saveSession({
          accessToken: res.token,
          userId: res.user.id,
          activeWorkspaceId: workspaceId || null,
          user: res.user,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        });
        AppLogger.info('auth', 'Session restored');
        return res;
      } else {
        // Online but session is invalid (e.g. null returned)
        AppLogger.warn('auth', 'Session validation returned empty/invalid');
        clearSession();
        setToken(null);
        setWorkspaceHeader(null);
        return null;
      }
    } catch (err: any) {
      // Check if it's a network error
      const isNetworkError =
        err.code === 'NETWORK_ERROR' ||
        err.message?.includes('fetch') ||
        err.message?.includes('network') ||
        err.status === null;
      if (isNetworkError) {
        AppLogger.info('auth', 'Offline session restored');
        // Let's load the locally saved session
        const session = loadSession();
        if (session && session.user) {
          // Verify expiration (if expiresAt exists)
          if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
            AppLogger.warn('auth', 'Offline session expired');
            clearSession();
            setToken(null);
            setWorkspaceHeader(null);
            return null;
          }
          // Restore token and workspace headers in Main memory
          setToken(session.accessToken);
          if (session.activeWorkspaceId) {
            setWorkspaceHeader(session.activeWorkspaceId);
          }
          return {
            token: session.accessToken,
            user: session.user
          };
        }
      }

      // If it's another error (like 401), clear the session!
      AppLogger.error('auth', 'Session validation failed with error', undefined, err);
      clearSession();
      setToken(null);
      setWorkspaceHeader(null);
      return null;
    }
  });

  safeRegister('system:status', async () => {
    return [
      { name: 'API Server', status: 'online' },
      { name: 'Database', status: 'connected' }
    ];
  });

  safeRegister('ipc:test', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });
}
