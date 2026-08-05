import { useAuthStore } from '../stores/auth-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { AuthService } from '../services/auth-service';
import { WorkspaceService } from '../services/workspace-service';

/**
 * useAuth is the primary hook for authentication state and actions.
 * It combines the AuthStore with AuthService calls so components
 * only need to call a single hook for all auth operations.
 */
export function useAuth() {
  const { state, setLoading, setAuthenticated, setUnauthenticated, setLoggedOut, clearError } =
    useAuthStore();
  const workspaceStore = useWorkspaceStore();

  const login = async (email: string, password: string) => {
    setLoading();
    try {
      const result = await AuthService.login({ email, password });
      setAuthenticated(result.user, result.token);

      // Load workspaces after login
      const workspaces = await WorkspaceService.listWorkspaces();
      const persistedActiveId = await WorkspaceService.getActiveWorkspaceId();

      let active = workspaces.find((w) => w.id === persistedActiveId) || null;
      if (!active) {
        active = workspaces.find((w) => w.id === result.user.activeWorkspaceId) || null;
      }
      if (!active && workspaces.length > 0) {
        active = workspaces[0] || null;
      }

      if (active) {
        await WorkspaceService.syncActiveWorkspace(active.id);
      } else {
        await WorkspaceService.syncActiveWorkspace(null);
      }

      workspaceStore.setWorkspaces(workspaces, active);
    } catch (err: any) {
      setUnauthenticated(err.message ?? 'Login failed');
      throw err;
    }
  };

  const register = async (email: string, password: string, name: string) => {
    setLoading();
    try {
      const result = await AuthService.register({ email, password, name });
      setAuthenticated(result.user, result.token);

      const workspaces = await WorkspaceService.listWorkspaces();
      const persistedActiveId = await WorkspaceService.getActiveWorkspaceId();

      let active = workspaces.find((w) => w.id === persistedActiveId) || null;
      if (!active) {
        active = workspaces.find((w) => w.id === result.user.activeWorkspaceId) || null;
      }
      if (!active && workspaces.length > 0) {
        active = workspaces[0] || null;
      }

      if (active) {
        await WorkspaceService.syncActiveWorkspace(active.id);
      } else {
        await WorkspaceService.syncActiveWorkspace(null);
      }

      workspaceStore.setWorkspaces(workspaces, active);
    } catch (err: any) {
      setUnauthenticated(err.message ?? 'Registration failed');
      throw err;
    }
  };

  const logout = async () => {
    await AuthService.logout();
    setLoggedOut();
    workspaceStore.reset();
  };

  const restoreSession = async () => {
    setLoading();
    const result = await AuthService.restoreSession();
    if (result) {
      setAuthenticated(result.user, result.token);

      const workspaces = await WorkspaceService.listWorkspaces();
      const persistedActiveId = await WorkspaceService.getActiveWorkspaceId();

      let active = workspaces.find((w) => w.id === persistedActiveId) || null;
      if (!active) {
        active = workspaces.find((w) => w.id === result.user.activeWorkspaceId) || null;
      }
      if (!active && workspaces.length > 0) {
        active = workspaces[0] || null;
      }

      if (active) {
        await WorkspaceService.syncActiveWorkspace(active.id);
      } else {
        await WorkspaceService.syncActiveWorkspace(null);
      }

      workspaceStore.setWorkspaces(workspaces, active);
    } else {
      setUnauthenticated();
    }
  };

  /**
   * refreshSession silently re-fetches the current session from the main process
   * and updates the auth store without a full page reload. Returns true if the
   * session is verified, false otherwise. Used by VerifyEmailScreen to detect
   * when emailVerified has flipped to true server-side.
   */
  const refreshSession = async (): Promise<boolean> => {
    const result = await AuthService.restoreSession();
    if (result) {
      setAuthenticated(result.user, result.token);
      return result.user?.emailVerified === true;
    }
    return false;
  };

  return {
    // State
    user: state.user,
    token: state.token,
    status: state.status,
    error: state.error,
    isAuthenticated: state.status === 'authenticated',
    isLoading: state.status === 'loading',
    isIdle: state.status === 'idle',
    // Actions
    login,
    register,
    logout,
    restoreSession,
    refreshSession,
    clearError
  };
}
