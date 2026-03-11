import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/database/postgres/schema.ts",
  out: "./src/database/postgres/migrations",
  migrations: {
    schema: "public",
    table: "paykit_migrations",
  },
});
