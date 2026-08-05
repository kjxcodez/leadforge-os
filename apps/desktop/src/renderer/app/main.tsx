// Record renderer initialization start timestamp
(window as any).__rendererInitStart = performance.now();

import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/globals.css';
import { AppProviders } from '../providers/AppProviders';
import { AppRouter } from '../router';
import { AppErrorBoundary } from '../components/common/AppErrorBoundary';

/**
 * Application entry point.
 *
 * AppErrorBoundary — catches unhandled React render errors, shows a premium fallback
 * AppProviders     — wraps all global state stores + React Query
 * AppRouter        — manages all routing with session-aware guards
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </AppErrorBoundary>
  </React.StrictMode>
);
