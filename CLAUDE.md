# CLAUDE.md

## Project Overview

PayKit is a TypeScript-first payments orchestration framework for modern SaaS.
It sits between your app and payment providers (Stripe, PayPal, regional PSPs),
providing a unified API without vendor lock-in. PayKit does **not** process
payments — it orchestrates them.

Read `docs/idea.md` before making architectural decisions.

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Build all packages (Turbo)
pnpm dev              # Dev mode (Turbo, persistent)
pnpm lint             # Lint with Biome (--error-on-warnings)
pnpm lint:fix         # Auto-fix lint issues
pnpm format           # Format with Biome
pnpm typecheck        # Type check (tsc --build)
```

Run specific tests with `vitest /path/to/<test-file> -t <pattern>`, not `pnpm test`.

## Tech Stack

- **Runtime**: Node.js >= 22 | **Package manager**: pnpm 10.4.1 (workspaces)
- **Build**: Turbo 2.8.10 | **Language**: TypeScript 5.9.2 (strict, composite)
- **Linter/Formatter**: Biome 2.3.14 | **Validation**: Zod 4
- **Git hooks**: Husky + lint-staged (runs `biome check --fix` on commit)

### Landing Page

- **Framework**: Next.js (App Router) | **Styling**: Tailwind CSS v4
- **Animations**: Framer Motion | **Components**: shadcn/ui + fumadocs-ui
- **Code highlighting**: Shiki with custom Vercel Dark theme (`landing/src/lib/shiki-vercel-theme.ts`), applied as default in `DynamicCodeBlock`

## Code Style

Enforced by Biome and TypeScript config. Follow strictly.

- Strict mode with `noUncheckedIndexedAccess`, `useConst` enforced
- `import type` with separated style; Node.js protocol (`node:fs`, `node:path`)
- `import * as z from "zod"`, never `import { z } from "zod"`
- No `@ts-ignore` (use `@ts-expect-error` with explanation), no `any` (use `unknown`), no `delete`, no implicit `any` on `let`
- All promises must be awaited or explicitly voided
- Avoid classes (use functions/objects) and enums (use `as const` or unions)
- No `Buffer` in library code — use `Uint8Array`. `Buffer` allowed in tests
- 2-space indent, Biome handles formatting — do not add Prettier

## Landing Page Conventions

- Use CSS variables for theme colors (`bg-background`, `bg-card`) — never hardcode hex in components
- Use standard Tailwind sizes (`text-xs`, `text-sm`, `text-base`) — avoid arbitrary pixel values
- Dark theme uses oklch color space with neutral grays (no chroma)

## Git & Testing

- PRs target `main`. Conventional Commits: `feat(scope):`, `fix(scope):`, `docs:`, `chore:`
- Scope = package name: `feat(stripe): add webhook handler`
- Vitest for tests. Add `@see` JSDoc with issue URL for regression tests

## Behavior

- When asked opinion questions ("what do you think?", "should we do X?"), **only answer** — don't make code changes unless explicitly asked
- Never `git commit`, `git push`, or run database migrations without explicit approval or being asked
- Before finishing, run `pnpm lint` and `pnpm typecheck`
