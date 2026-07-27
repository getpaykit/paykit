#!/usr/bin/env bash
set -euo pipefail

# 1. Set the primary worktree path if Cursor did not already.
if [[ -z "${ROOT_WORKTREE_PATH:-}" ]]; then
  ROOT_WORKTREE_PATH="$(cd "$(git rev-parse --git-common-dir)/.." && pwd -P)"
fi

# 2. Copy top-level env files from the primary worktree.
for file in "$ROOT_WORKTREE_PATH"/.env "$ROOT_WORKTREE_PATH"/.env.*; do
  name="$(basename "$file")"
  if [[ "$name" == *.example ]]; then
    continue
  fi
  if [[ -f "$file" && ! -e "$name" ]]; then
    cp "$file" "$name"
  fi
done

# 3. Install dependencies.
pnpm install --frozen-lockfile
