# 4. Shared Packages Audit (packages/)

The `packages/` directory is currently **empty**. Every piece of business logic, layout helper, styling token, and utility code is coupled inside `apps/desktop/src/`. This design introduces build bloat and blocks reuse by future worker/API apps.

Below is the deconstruction and package architecture blueprint to guide extraction.

---

## 1. Core Packages Rationale & Extraction Strategy

### 1.1 `packages/types`
- **Purpose**: Pure TypeScript types, DTO contracts, and IPC interface definitions.
- **Public API**: `IContact`, `ICampaign`, `IWorkflow`, `IpcChannels`.
- **Dependencies**: None.
- **Internal Architecture**: Contains static declaration files (`*.types.ts`) structured by domain models.
- **What should never live there**: JavaScript code, functions, classes, or database operations.

### 1.2 `packages/shared`
- **Purpose**: Workspace-wide constants, parsing utilities, and input validation schemas.
- **Public API**: `VerifyEmailSchema`, `DTOValidator`, formatting functions, date helpers.
- **Dependencies**: `zod`, `lodash`.
- **Internal Architecture**: Modular folder layout containing pure deterministic functions.
- **What should never live there**: React UI components or platform-native Node APIs (e.g. `fs`, `electron`).

### 1.3 `packages/ui`
- **Purpose**: Atomic design system components.
- **Public API**: Button, Table, Card, Dialog, Sidebar elements.
- **Dependencies**: React, Tailwind CSS v4, `@base-ui/react`, `lucide-react`.
- **Internal Architecture**: Atomic component folders mapped directly onto Tailwind v4 custom theme classes.
- **What should never live there**: Business rules, state management stores (Zustand), or database queries.

### 1.4 `packages/integrations`
- **Purpose**: API clients and adapter wrappers for external resources (Apify, Hunter, OpenRouter).
- **Public API**: `HunterProvider`, `ApifyScraper`, `EmailVerifier`.
- **Dependencies**: Axios, `packages/types`, `packages/shared`.
- **Internal Architecture**: Classes implementing standardized client interfaces.
- **What should never live there**: Main process window controls or UI elements.
