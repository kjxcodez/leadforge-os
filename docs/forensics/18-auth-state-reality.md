# Phase 1 Forensic Document 18 — Authentication State Reality

**Document Type:** Forensic Authentication & Session Audit  
**Audited Against:** `apps/desktop/src/main/lib/session.ts`, `apps/desktop/src/main/ipc/auth.ts`, `apps/api/src/routes/auth/`  
**Date:** September 2026  
**Status:** Authoritative Baseline  

---

## 1. Authentication Lifecycle & Storage Matrix

| Lifecycle Stage | Storage / Mechanism | Behavior / Network Action | Failure / Edge Case |
| :--- | :--- | :--- | :--- |
| **Cold Start Session Restore** | `%APPDATA%/leadforge/config.json` | Reads `session.accessToken` and `activeWorkspaceId` synchronously from disk. | If file missing, boots in unauthenticated state (`/login`). |
| **Online Sign-In** | `POST /api/v1/auth/sign-in` | Validates credentials via Better Auth; returns session token and user object. | Bad credentials return 401. |
| **Online Sign-Up** | `POST /api/v1/auth/sign-up` | Creates user in MongoDB `users` collection; returns session token. | Duplicate email returns 400. |
| **Session Persistence** | `%APPDATA%/leadforge/config.json` | Writes `{ accessToken, user, activeWorkspaceId }` to local JSON file. | Atomic disk write. |
| **API Request Authorization** | HTTP Header `Authorization: Bearer <token>` | `SdkClient` dynamically calls `tokenResolver()` to inject token on every request. | If token is null, sends unauthenticated request. |
| **401 Unauthorized Trigger** | `SdkClient.onUnauthorized` callback | Clears local session, sets `activeToken = null`, sends `auth:unauthorized` to renderer. | Renderer automatically navigates to `/login`. |
| **Sign-Out** | `auth:logout` IPC | Clears `config.json`, tears down active `WorkspaceRuntime`, resets memory tokens. | Clean process state. |

---

## 2. API Unavailable vs Auth State Discrepancy

### Critical Observation:
Can a user appear logged in while the API is down? **YES.**

1. `loadSession()` reads stored tokens from local disk (`config.json`).
2. There is **no online token verification or heartbeat** performed at the moment of cold start.
3. Therefore, if the API server is down, the Electron app restores the session locally and displays the full dashboard as if the user is authenticated and healthy.
4. Only when a request returns 401 does the app clear the session. Because an unreachable server returns `ECONNREFUSED` (network error, not HTTP 401), `onUnauthorized` does NOT fire, keeping the user in a pseudo-authenticated state.

---

## 3. Verdict

- **Authentication System:** **IMPLEMENTED & FUNCTIONAL** (Backed by Better Auth + JWT session storage).
- **Offline Session Guard:** **MISSING / DEGRADED** (Lacks startup network reachability probe).
