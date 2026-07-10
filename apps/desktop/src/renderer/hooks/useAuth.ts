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
      const active = WorkspaceService.resolveActiveWorkspace(workspaces, result.user.activeWorkspaceId);
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
      const active = WorkspaceService.resolveActiveWorkspace(workspaces, result.user.activeWorkspaceId);
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
      const active = WorkspaceService.resolveActiveWorkspace(workspaces, result.user.activeWorkspaceId);
      workspaceStore.setWorkspaces(workspaces, active);
    } else {
      setUnauthenticated();
    }
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
    clearError,
  };
}
