# Contributing to PayKit

Thanks for your interest in contributing! This guide will help you get set up and explain how we work.

For questions or ideas, open a [GitHub issue](https://github.com/getpaykit/paykit/issues) before starting large work.

## Prerequisites

- **Node.js** >= 22
- **pnpm** (install via [pnpm.io](https://pnpm.io/installation))

## Local Setup

```bash
# Fork then clone
git clone https://github.com/<your-username>/paykit.git
cd paykit

pnpm install
pnpm build
```

## Development

```bash
pnpm dev          # Watch mode (Turbo)
pnpm typecheck    # tsc --build
pnpm lint         # oxlint --deny-warnings
pnpm lint:fix     # Auto-fix lint issues
pnpm format       # oxfmt
pnpm format:check # Check formatting without writing
```

## Monorepo Structure

```
packages/
  paykit/       # Core orchestration package
  stripe/       # Stripe provider
  dash/         # Dashboard
  polar/  # Polar provider
apps/
  demo/         # Demo app
landing/        # Next.js marketing site
e2e/            # End-to-end tests
```

## Testing

We use [Vitest](https://vitest.dev/). Run a specific test file or pattern:

```bash
vitest /path/to/test-file -t "pattern"
```

- Bug fixes and new features must include tests.
- For regression tests, add a `@see` JSDoc comment with the issue URL:

```ts
/** @see https://github.com/getpaykit/paykit/issues/123 */
it("does not throw when ...", () => {
```

## Code Style

Enforced by **oxlint** and **oxfmt** (not Prettier or Biome; do not add them). For a deeper reference on conventions and tooling, see [`AGENTS.md`](./AGENTS.md).

Key rules:

- TypeScript strict mode; no `any`, no `@ts-ignore` (use `@ts-expect-error` with an explanation)
- `import type` for type-only imports, separated from value imports
- `import * as z from "zod"`, never `import { z } from "zod"`
- No enums; use `as const` objects or union types
- No classes; use plain functions and objects
- Node.js built-ins use the `node:` protocol (`node:fs`, `node:path`)
- No `Buffer` in library code; use `Uint8Array`

## Commits & Pull Requests

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(stripe): add webhook handler
fix(paykit): correct subscription renewal logic
docs: update README setup steps
chore: bump pnpm to 10.4.1
```

The scope is the **package name** (`paykit`, `stripe`, `dash`, `better-auth`).

- PRs target `main`
- For bug fixes or non-breaking improvements, a PR is enough
- For new features or breaking changes, open an issue first to discuss

## Changesets

When you change anything under `packages/`, run:

```bash
pnpm changeset
```

Follow the prompts to describe the change. Commit the generated `.changeset/*.md` file with your PR.

## Reporting Bugs

Search [existing issues](https://github.com/getpaykit/paykit/issues) first. If none match, open a new one with:

- A minimal reproduction
- Expected vs. actual behavior
- Node.js version and relevant package versions

## Security

**Do not open a public issue for security vulnerabilities.** Email [security@paykit.sh](mailto:security@paykit.sh) instead.

## AI-Assisted Contributions

AI-assisted PRs are welcome. The bar is the same as for any other PR: the change solves a real problem, includes tests, and the contributor can speak to the code in review.
