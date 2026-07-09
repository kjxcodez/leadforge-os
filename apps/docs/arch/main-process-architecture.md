# 7. Main Process Audit

The Electron Main Process is the shell controller for LeadForge OS. It executes in a full Node.js context and handles OS integration.

---

## 1. Process Folders & Responsibilities

The current main process is inlined in `apps/desktop/src/main/index.ts`. To support scaling, we recommend splitting it into modular service domains:

- **`windows/`**: Responsibilities include configuring `BrowserWindow` parameters, injecting the preload script, and managing layout coordinates.
- **`ipc/`**: Responsibilities include registering IPC channels and routing calls to core services.
- **`services/`**: Responsibilities include file storage actions, encryption, and local SQLite DB operations.
- **`scheduler/`**: Responsibilities include managing background tasks and CRON timers.
- **`tray/` & `menus/`**: Responsibilities include drawing native application menus and tray actions.

---

## 2. Forbidden Responsibilities in the Main Process

To prevent application lockups, memory leaks, and security vulnerabilities, the Main process has strict design boundaries:

1. **No UI State/Rendering**: The Main process must never import React, styles, or handle UI render loops.
2. **No Long-Running Scrapes**: Playwright instances or data processing tasks must never run inside the Main thread, as they block the main event loop, causing the Electron window to freeze. These must be spawned as child workers.
3. **No Dynamic Code Evaluation**: Never run `eval()` or load external scripts from unchecked sources.
