# Electron Desktop Application

This document covers the structure and implementation details of the LeadForge OS desktop application (`apps/desktop`).

---

## 🏗️ Folder Structure

```text
apps/desktop/
├── src/
│   ├── main/                  # Electron Main Process (Node.js runtime)
│   │   ├── database/          # SQLite connections, models, and migrations
│   │   ├── ipc/               # IPC handlers (observability, database, jobs)
│   │   ├── lib/               # Event bus, AppLogger, telemetry
│   │   ├── services/          # JobScheduler, SyncEngine, UpdateManager
│   │   └── workers/           # worker-host and scraper/outreach plugins
│   ├── preload/               # Electron Preload Script (contextBridge)
│   └── renderer/              # React UI Renderer (Chromium runtime)
│       ├── src/
│       │   ├── components/    # Reusable shadcn/ui React components
│       │   ├── hooks/         # React Query hooks calling window.ipc
│       │   ├── pages/         # Dashboard, CRM lists, Cockpit, Settings
│       │   └── App.tsx        # React Router routes and provider context
└── package.json               # Desktop scripts, dependencies, build targets
```

---

## 📡 IPC contextBridge Security

To comply with Electron security guidelines, the Renderer process has no direct access to Node.js APIs (such as `fs`, `child_process`, or raw SQLite packages). It communicates exclusively through the preload script context bridge.

### Bridge API
The preload script exposes the `window.ipc` interface containing standard methods:
- `window.ipc.invoke(channel, payload)`: Sends a request to the Main process and returns a Promise.
- `window.ipc.on(channel, callback)`: Listens for events sent from the Main process.
- `window.ipc.removeAllListeners(channel)`: Cleans up listeners when components unmount.

All channel strings are validated against a whitelist in `preload/index.ts` to prevent execution of unauthorized commands.

---

## 💾 Local SQLite Database Connections

The desktop application manages local CRM records using SQLite through the `better-sqlite3` driver.

###WAL Mode & Connection Pools
- Database connections are initialized in WAL (Write-Ahead Logging) mode using `connection.ts` to support high-concurrency writes during crawler runs.
- `PRAGMA synchronous = NORMAL` is enabled to improve write performance while preserving database durability.
- Workspaces are physically isolated. Each workspace has its own database file named `leadforge_${workspaceId}.db` located in the OS appData directory.
- On boot, the migration runner applies schema statements sequentially, validating tables (`companies`, `contacts`, `jobs`, `sync_queue`, `automation_locks`).
