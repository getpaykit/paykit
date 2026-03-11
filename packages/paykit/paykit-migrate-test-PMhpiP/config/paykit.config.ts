import { createPayKit } from "/Users/maxktz/.codex/worktrees/6bbd/paykit/packages/paykit/src/index.ts";
import { mockProvider } from "/Users/maxktz/.codex/worktrees/6bbd/paykit/packages/paykit/src/test-utils/mock-provider.ts";
import { createPGlitePool } from "/Users/maxktz/.codex/worktrees/6bbd/paykit/packages/paykit/src/test-utils/pglite-pool.ts";

import { env } from "@/env";

const globalKey = "__paykit_cli_default";
const storedPool = (globalThis as Record<string, unknown>)[globalKey] as
  | ReturnType<typeof createPGlitePool>
  | undefined;
const pool = storedPool ?? createPGlitePool();
(globalThis as Record<string, unknown>)[globalKey] = pool;
void env.DATABASE_URL;
export default createPayKit({ database: pool, providers: [mockProvider()] });
