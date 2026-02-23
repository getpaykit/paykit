# AGENTS.md

This file provides guidance to AI assistants (Claude Code, Cursor, etc.)
when working with code in this repository.

## Project Overview

PayKit is a TypeScript-first payments orchestration framework for modern
SaaS. It sits between your app and payment providers (Stripe, PayPal,
regional PSPs), providing a unified API without vendor lock-in.

PayKit does **not** process payments. It orchestrates them.

Read `docs/idea.md` before making any architectural decisions — it contains
the project philosophy, architecture, and design constraints.

## Project Status

Early development. No packages exist yet. See `docs/roadmap.md` for the
phased plan and `docs/todo.md` for active tasks.

## Documentation

```
docs/
  idea.md        Main design doc (philosophy, architecture, features, business)
  roadmap.md     Phased implementation plan
  todo.md        Active task list
  references.md  Design inspiration
```

## Monorepo Structure

```
packages/       Workspace packages (apps/* and packages/*)
  paykit/       Core orchestration library
  stripe/       Stripe provider adapter
  paypal/       PayPal provider adapter
  prisma/       Prisma database adapter
  drizzle/      Drizzle database adapter
  cli/          CLI for migrations and scaffolding
```

Not all packages exist yet. Do not scaffold packages without being asked.

## Development Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (Turbo)
pnpm dev              # Dev mode (Turbo, persistent)
pnpm lint             # Lint with Biome (--error-on-warnings)
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format with Biome
pnpm typecheck        # Type check (tsc --build)
```

Do not run `pnpm test` for the full suite — use
`vitest /path/to/<test-file> -t <pattern>` to run specific tests.

## Tech Stack

- **Runtime**: Node.js >= 22 (pinned in `.nvmrc`)
- **Package manager**: pnpm 10.4.1 (workspaces)
- **Build system**: Turbo 2.8.10
- **Language**: TypeScript 5.9.2 (strict, composite, verbatimModuleSyntax)
- **Formatter / Linter**: Biome 2.3.14
- **Validation**: Zod 4
- **Git hooks**: Husky + lint-staged (runs `biome check --fix` on commit)

## Code Style

These are enforced by Biome and TypeScript config. Follow them strictly.

### TypeScript

- Strict mode with `noUncheckedIndexedAccess`
- Use `const` always (`useConst` enforced)
- Use `import type` with separated style for type-only imports
- Use Node.js import protocol: `node:fs`, `node:path`, `node:crypto`
- Use `import * as z from "zod"`, never `import { z } from "zod"`
- No `@ts-ignore` (error). Use `@ts-expect-error` with explanation if
  absolutely necessary
- No `any`. Use `unknown` and narrow with type guards
- No `delete` operator (use `undefined` assignment or destructuring)
- No implicit `any` on `let` declarations
- All promises must be awaited or explicitly voided (`void promise`)
- Avoid classes. Use functions and plain objects
- Avoid enums. Use `as const` objects or union types

### Runtime

- Do not use `Buffer` in library code (`packages/**/src/**`). Use
  `Uint8Array` instead. `Buffer` is allowed in tests
- Do not use `Date.now()` alternatives — use `Date.now()` directly
  (`useDateNow` enforced)

### Formatting

- 2-space indent for all files (JS, TS, JSON)
- Biome handles formatting — do not add Prettier

## Design Principles

When writing code for PayKit, follow these principles from `docs/idea.md`:

- **Orchestration, not processing** — PayKit coordinates providers, it
  does not move money
- **Database is source of truth** — external providers are execution
  engines, internal state lives in your DB
- **Provider-agnostic** — no provider-specific types leak into the core
  API. Provider details are always namespaced
- **Explicit state transitions** — subscription lifecycle is
  state-machine driven, no implicit side effects
- **No magic** — everything is explicit, typed, and inspectable
- **Minimal API surface** — don't add options or features speculatively.
  Start with the minimum that works

## Testing

- Test framework: Vitest
- Use test helpers when available
- If a test prevents regression of a specific GitHub issue, add a JSDoc
  `@see` comment with the issue URL above the `it()` or `describe()`

## Git Workflow

- PRs target the `main` branch
- Commit format follows Conventional Commits:
  `feat(scope): description`, `fix(scope): description`
- Use `docs:` for documentation, `chore:` for non-functional changes
- Scope should be the package name: `feat(stripe): add webhook handler`

## Before Finishing

**Unless the user explicitly asks, DO NOT COMMIT.**

Before considering work done, make sure these pass:

```bash
pnpm lint
pnpm typecheck
```
