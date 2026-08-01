# 9. Security Architecture

LeadForge OS hosts native database queries and API keys on client machines. This document outlines the security boundaries and constraints.

---

## 1. Electron Isolation & Sandboxing

The Renderer process has zero direct operating system access.

- **Context Isolation**: `contextIsolation: true` is enforced.
- **Process Sandboxing**: `sandbox: true` runs Chromium in a limited user profile.
- **CSP Constraints**: Restricts frame-ancestors, web connections, and script origins to local file sources:
  `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;`

---

## 2. Secure Credential Storage

1. **OS Keychain Binding**: User API tokens (for Hunter, Apify, OpenRouter) must be encrypted at rest using Electron's `safeStorage` API, which binds credentials to native OS cryptographic keychains:
   - macOS: Keychain Access
   - Windows: Data Protection API (DPAPI)
   - Linux: libsecret
2. **Database Security**: Local SQLite database files containing corporate data must use encryption extension layers (such as SQLCipher).

---

## 3. IPC & Updater Verification

- **Zod IPC Filtering**: Every message reaching the Main process over IPC must be verified against strict Zod input schemas.
- **Code Signing**: All release builds compiled via `electron-builder` must be cryptographically signed. The client auto-updater will check matching signature keys before unpacking update archives to block malicious payload injections.
