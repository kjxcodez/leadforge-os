import React from 'react';
import ReactDOM from 'react-dom/client';
import '@/shared/styles/globals.css';
import { AppProviders } from '../providers/AppProviders';
import { AppRouter } from '../router';

/**
 * Application entry point.
 *
 * AppProviders — wraps all global state stores + React Query
 * AppRouter    — manages all routing with session-aware guards
 */
ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>
);
