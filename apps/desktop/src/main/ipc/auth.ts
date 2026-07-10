import { safeRegister } from './helper';
import { SdkClient } from '@leadforge/sdk';

/**
 * Registers authentication and API test IPC channels.
 */
export function registerAuthIpc(
  sdk: SdkClient,
  setToken: (token: string | null) => void,
  setWorkspaceHeader: (workspaceId: string | null) => void,
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
  });

  safeRegister('auth:session', async () => {
    return sdk.auth.session();
  });

  safeRegister('system:status', async () => {
    return [
      { name: 'API Server', status: 'online' },
      { name: 'Database', status: 'connected' },
    ];
  });

  safeRegister('ipc:test', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });
}
