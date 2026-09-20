import { LibSQLStore } from "@mastra/libsql";

import { env } from "../env";

export const storage = new LibSQLStore({
  id: "paykit-docs-agent-storage",
  url: env.TURSO_DATABASE_URL ?? env.MASTRA_STORAGE_URL ?? "file:./mastra.db",
  authToken: env.TURSO_AUTH_TOKEN,
});
