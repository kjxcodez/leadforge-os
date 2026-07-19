import React, { useEffect } from 'react';
import { createHashRouter, RouterProvider, Navigate } from 'react-router-dom';
import { ProtectedRoute, GuestRoute } from './guards';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { BlankLayout } from '../layouts/BlankLayout';
import { SplashScreen } from '../screens/SplashScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/ForgotPasswordScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { SessionExpiredScreen } from '../screens/SessionExpiredScreen';
import { useAuth } from '../hooks/useAuth';
import { useAuthStore } from '../stores/auth-store';
import { useWorkspaceStore } from '../stores/workspace-store';
import { queryClient } from '../providers/AppProviders';
import WorkspaceSettingsScreen from '../screens/WorkspaceSettingsScreen';
import WorkspaceInvitesScreen from '../screens/WorkspaceInvitesScreen';
import DashboardScreen from '../screens/DashboardScreen';
import CompaniesScreen from '../screens/CompaniesScreen';
import ContactsScreen from '../screens/ContactsScreen';
import DiscoveryScreen from '../screens/DiscoveryScreen';
import CampaignsScreen from '../screens/CampaignsScreen';
import AutomationScreen from '../screens/AutomationScreen';
import DiagnosticsScreen from '../screens/DiagnosticsScreen';
import ReportsScreen from '../screens/ReportsScreen';


// ---------------------------------------------------------------------------
// Session Bootstrap
// ---------------------------------------------------------------------------

/**
 * SessionBootstrap runs the session restore logic once on app startup.
 * It lives here rather than in main.tsx so it has access to all providers.
 */
function SessionBootstrap({ children }: { children: React.ReactNode }) {
  const { restoreSession, isIdle } = useAuth();
  const { setLoggedOut } = useAuthStore();
  const workspaceStore = useWorkspaceStore();

  useEffect(() => {
    if (isIdle) {
      restoreSession();
    }
  }, [isIdle, restoreSession]);

  useEffect(() => {
    const unsubscribe = window.ipc.on('auth:unauthorized', () => {
      setLoggedOut();
      workspaceStore.reset();
      queryClient.clear();
      window.location.hash = '#/session-expired';
    });

    return () => {
      unsubscribe();
    };
  }, [setLoggedOut, workspaceStore]);

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Placeholder screens for CRM routes (Phase 2+)
// ---------------------------------------------------------------------------

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 h-full text-muted-foreground">
      <p className="text-sm font-medium">{label}</p>
      <p className="text-xs mt-1 opacity-60">Coming in Phase 2</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Router definition
// ---------------------------------------------------------------------------

/**
 * We use HashRouter (createHashRouter) because Electron serves files from disk.
 * BrowserRouter requires a server to handle history-based navigation.
 */
const router = createHashRouter([
  // ── Splash / session idle ────────────────────────────────────────────────
  {
    path: '/splash',
    element: <BlankLayout><SplashScreen /></BlankLayout>,
  },

  // ── Session expired ──────────────────────────────────────────────────────
  {
    path: '/session-expired',
    element: <BlankLayout><SessionExpiredScreen /></BlankLayout>,
  },

  // ── Auth routes (guests only) ────────────────────────────────────────────
  {
    element: <GuestRoute />,
    children: [
      {
        element: <AuthLayout />,
        children: [
          { path: '/auth/login', element: <LoginScreen /> },
          { path: '/auth/register', element: <RegisterScreen /> },
          { path: '/auth/forgot-password', element: <ForgotPasswordScreen /> },
          { path: '/auth/verify-email', element: <VerifyEmailScreen /> },
        ],
      },
    ],
  },

  // ── App routes (authenticated only) ─────────────────────────────────────
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <Navigate to="/dashboard" replace /> },
          {
            path: '/dashboard',
            element: <DashboardScreen />,
          },
          { path: '/companies', element: <CompaniesScreen /> },
          { path: '/contacts', element: <ContactsScreen /> },
          { path: '/campaigns', element: <CampaignsScreen /> },
          { path: '/discovery', element: <DiscoveryScreen /> },
          { path: '/automation', element: <AutomationScreen /> },
          { path: '/workflows', element: <Navigate to="/automation" replace /> },
          { path: '/reports', element: <ReportsScreen /> },
          { path: '/settings', element: <WorkspaceSettingsScreen /> },
          { path: '/invites', element: <WorkspaceInvitesScreen /> },
          { path: '/diagnostics', element: <DiagnosticsScreen /> },
        ],
      },
    ],
  },

  // ── Fallback ─────────────────────────────────────────────────────────────
  { path: '*', element: <Navigate to="/" replace /> },
]);

// ---------------------------------------------------------------------------
// AppRouter
// ---------------------------------------------------------------------------

/**
 * AppRouter wraps React Router with the session bootstrap logic.
 */
export function AppRouter() {
  return (
    <SessionBootstrap>
      <RouterProvider router={router} />
    </SessionBootstrap>
  );
}
