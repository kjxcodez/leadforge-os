# 6. Renderer Process Audit

The React frontend application lives inside `apps/desktop/src/renderer/`. This document outlines the folder boundaries and import rules to support feature scaling.

---

## 1. Directory Tree & Folder Responsibilities

The React codebase is currently structured into three directories:
- `src/renderer/app/`: bootstrapping entry (`main.tsx`) and layout shell (`App.tsx`).
- `src/renderer/screens/`: modular files representing dashboard pages.
- `src/renderer/components/ui/`: primitive Shadcn UI components.

To scale the frontend to 500k+ lines of code, the following folder model is recommended:

```text
src/renderer/
├── app/                  # App shell, routing registry, global style binds
├── components/           # Stateless, generic UI elements (Buttons, Tables, Cards)
├── features/             # Domain-specific modules (CRM, Campaigns, Workflows)
│   ├── crm/              # CRM feature: components, hooks, api hooks
│   └── campaigns/
├── hooks/                # Global React hooks (useIpc, useTheme)
├── providers/            # React Context providers (ReactQuery, Theme)
├── lib/                  # Configurations (Axios client, QueryClient setup)
└── assets/               # Local fonts, SVG assets, logos
```

---

## 2. Dependency Directions & Import Rules

1. **Sideways Imports Blocked**: Subfolders under `features/` (like `crm/` and `campaigns/`) are completely isolated. `crm/` must never import from `campaigns/` directly; any shared logic must be extracted to `components/`, `hooks/`, or `packages/shared`.
2. **One-Way Downward Flow**:
   - `app/` imports `features/` and `providers/`.
   - `features/` imports `components/`, `hooks/`, `lib/`.
   - `components/` imports `lib/` and generic utils.
3. **No circular imports**: Enforced via ESLint rules to prevent compilation locks.
