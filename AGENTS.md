# AGENTS.md

## Project

PayKit is an embedded billing framework for TypeScript apps. It runs inside the
user's app, uses their database, and provides APIs for plans, subscriptions,
entitlements, and usage billing.

PayKit should feel like application code, not a hosted billing platform or a thin
provider SDK wrapper. Keep provider-specific details behind typed, composable
APIs.

## Code Style

- Follow the repository's formatter, linter, and TypeScript config.
- Use `import type` for type-only imports.
- Prefer functions and plain objects over classes.
- Keep comments rare and about code logic. Do not add unnecessary separator comments.
- Prefer keeping code comments single line over multi line, exception for JSDoc
- Prefer adding JSDoc on most functions in the library core, and on some object properties mainly if api is used in many places, or user-facing
- Keep JSDoc strings short and useful
- while writing JSDoc follow it's standards, such as tags

## References

If you need to inspect source code of libraries or packages, prefer inspecting
cloned source repositories when available, rather than library dist files.

These directories already contain source checkouts for some packages:

- `~/ref/fumadocs` - fumadocs framework / package.

## Behavior

- When asked opinion questions, answer only. Do not edit code unless explicitly asked.
- Never commit, push, or run database migrations unless explicitly asked.
- Never create a partial commit from files that also contain unstaged changes.
  If a requested commit overlaps dirty files, either commit the full intended
  change or stop and ask. Do not rely on hooks stashing/hiding unstaged changes.
- If a commit hook fails while hiding or restoring unstaged changes, stop
  immediately and recover the user's unstaged work before retrying or committing
  anything.
- When generating migrations, always provide a name.
- Never edit past migrations; create a new migration instead.
- Never run "deploy" scripts to test anything, only if explicitly asked
- NEVER EVER publish or release packages yourself, ask double confirmation
