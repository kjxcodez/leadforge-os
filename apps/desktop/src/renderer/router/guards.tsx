import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../stores/auth-store';
import { BlankLayout } from '../layouts/BlankLayout';
import { SplashScreen } from '../screens/SplashScreen';

// ---------------------------------------------------------------------------
// ProtectedRoute
// ---------------------------------------------------------------------------

/**
 * ProtectedRoute guards application routes that require authentication.
 * Redirects to /auth/login when the session is not authenticated.
 * Shows nothing while the initial session check is still in flight.
 */
export function ProtectedRoute() {
  const { state } = useAuthStore();

  // Still determining session status — render SplashScreen to avoid flash
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <BlankLayout>
        <SplashScreen />
      </BlankLayout>
    );
  }

  if (state.status === 'unauthenticated') {
    return <Navigate to="/auth/login" replace />;
  }

  if (state.status === 'authenticated' && !state.user?.emailVerified) {
    return <Navigate to="/auth/verify-email" replace />;
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// GuestRoute
// ---------------------------------------------------------------------------

/**
 * GuestRoute guards authentication pages (login, register).
 * Redirects authenticated users to the app home to prevent re-auth loops.
 */
export function GuestRoute() {
  const { state } = useAuthStore();

  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <BlankLayout>
        <SplashScreen />
      </BlankLayout>
    );
  }

  if (state.status === 'authenticated') {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

// ---------------------------------------------------------------------------
// SessionRoute
// ---------------------------------------------------------------------------

/**
 * SessionRoute wraps the splash screen logic.
 * It renders until the auth status has been resolved from 'idle',
 * then defers to the router to pick the correct destination.
 */
export function SessionRoute({ children }: { children: React.ReactNode }) {
  const { state } = useAuthStore();

  if (state.status === 'idle') {
    // Session check hasn't started — render splash
    return <>{children}</>;
  }

  return null;
}
