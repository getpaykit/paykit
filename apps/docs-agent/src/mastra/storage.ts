import { LibSQLStore } from "@mastra/libsql";

export const storage = new LibSQLStore({
  id: "paykit-docs-agent-storage",
  url: process.env.TURSO_DATABASE_URL ?? process.env.MASTRA_STORAGE_URL ?? "file:./mastra.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});
