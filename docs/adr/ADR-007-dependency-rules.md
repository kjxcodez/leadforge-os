# ADR-007: Dependency Rules & Import Restrictions

## Status

Proposed

## Context

In a multi-package monorepo, it is easy to introduce circular dependencies or violate architectural boundaries by importing modules across package limits. For example, a business agent importing OpenRouter clients directly bypasses the runtime abstraction. We need a strict set of dependency rules enforced at the monorepo level.

## Decision

We will restrict import paths between monorepo packages using TypeScript project references and ESLint boundaries:

1. **Runtime (`packages/ai`)**: Depends only on `schema` and `core`. Must never import `agent-sdk`, `agents`, or Electron.
2. **SDK (`packages/agent-sdk`)**: Depends on `ai` (interfaces only) and `schema`. Must never import `agents`, Electron, or SQLite connections.
3. **Agents (`packages/agents`)**: Depends on `agent-sdk` and `schema`. Must never import provider-specific code or raw HTTP clients.
4. **Desktop App (`apps/desktop`)**: Serves as the application shell; can depend on all packages.

No package other than `apps/desktop` may import Electron or SQLite.

## Alternatives Considered

- **Trust-Based Enforcement**: Rely on developers to follow guidelines without compiler/lint rules.
  - _Tradeoffs_: High risk of architectural drift over time as the team grows.
- **Bespoke Monorepo Linting Scripts**: Write custom bash scripts to check dependencies.
  - _Tradeoffs_: Harder to maintain than standard ESLint or TypeScript configurations.

## Tradeoffs

- **Pros**:
  - **No Circular Dependencies**: TypeScript projects cannot compile circular structures.
  - **Clear Interfaces**: Restricts developers from using implementation details instead of interfaces.
- **Cons**:
  - Requires setting up TypeScript project references.

## Consequences

- Architectural boundaries are enforced during local development and CI build pipelines.
- Violating import rules causes build compilation failures.
