# 2. Complete Folder Tree & Directory Audit

This document details the actual directory structure currently tracked in the repository, along with ownership, boundaries, and lifecycles.

## The Actual Tracked Repository Tree

Below is the directory map of the tracked files currently in the workspace:

```text
leadforge-os/
├── apps/
│   ├── desktop/                         # Standalone Electron client app
│   │   ├── src/
│   │   │   ├── main/                    # Electron main process source
│   │   │   │   └── index.ts
│   │   │   ├── preload/                 # Preload contextBridge script
│   │   │   │   └── index.ts
│   │   │   ├── renderer/                # React frontend application
│   │   │   │   ├── app/                 # Root entry and main controller shell
│   │   │   │   ├── components/ui/       # Shadcn UI primitives (e.g. button.tsx)
│   │   │   │   └── screens/             # Modular dashboard screen layouts
│   │   │   └── shared/                  # Common resources (styles, utilities, schemas)
│   │   │       ├── styles/globals.css
│   │   │       └── utils/cn.ts
│   │   ├── components.json              # Shadcn configuration file
│   │   ├── electron.vite.config.js      # Build config for main, preload, renderer
│   │   ├── index.html                   # HTML served in development
│   │   ├── package.json                 # Desktop app dependencies
│   │   └── tsconfig.json                # Desktop typescript compiler rules
│   └── docs/                            # Documentation package
│       ├── arch/                        # Canonical architecture blueprints
│       │   └── leadforge_architecture_and_product_design.md
│       └── DESIGN.md                    # Visual design system specification
├── packages/                            # [EMPTY] Target directory for shared workspace libraries
├── package.json                         # Workspace root dependencies
├── pnpm-lock.yaml                       # Strict package lockfile
├── pnpm-workspace.yaml                  # Workspace directory definition
├── tsconfig.json                        # Base TypeScript rules
└── turbo.json                           # Task pipeline definitions
```

---

## Directory Audit & Metadata

### 1. `apps/desktop`
- **Purpose**: Hosts the Electron app shell (desktop interface).
- **Owner**: Core Desktop Engineering Squad.
- **Dependencies**: React, Tailwind, Lucide, `@electron-toolkit/utils`, and internally structured files under `src/shared/`.
- **Consumers**: Local end-users (packaged as native binaries via `electron-builder`).
- **Public/Internal**: Public (End-user product).
- **Expected Future Contents**: Modular screens, services for IPC calls, local SQLite schema setups.
- **Lifecycle**: Active.

### 2. `apps/docs`
- **Purpose**: Contains visual design specifications and canonical architecture books.
- **Owner**: Architecture Board / Product Designers.
- **Dependencies**: Markdown compiler, Docusaurus (future).
- **Consumers**: Engineering team, prospective hires, contracting teams.
- **Public/Internal**: Internal (Developer documentation).
- **Expected Future Contents**: Feature flowcharts, API endpoints documentation, deployment walkthroughs.
- **Lifecycle**: Active.

### 3. `packages/`
- **Purpose**: Designated folder to extract common modules out of the desktop monolith.
- **Owner**: Platform Infrastructure Team.
- **Dependencies**: None (currently empty).
- **Consumers**: `apps/desktop` (future).
- **Public/Internal**: Internal modules.
- **Expected Future Contents**: Libraries for databases, API synchronization, workflow engines, logging, and types.
- **Lifecycle**: Draft. Needs implementation starting in Horizon 1.
