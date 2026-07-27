import path from "node:path";
import { fileURLToPath } from "node:url";

import { config } from "dotenv";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Load repo-root `.env` and `.env.local` into `process.env`. */
export function loadRootEnv() {
  config({ path: path.join(repoRoot, ".env"), quiet: true });
  config({ path: path.join(repoRoot, ".env.local"), override: true, quiet: true });
}

loadRootEnv();
