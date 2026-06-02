import { defineConfig } from "drizzle-kit";
import "dotenv/config";

export default defineConfig({
  dialect: "postgresql",
  schema: "../../packages/paykit/src/database/schema.ts",
  out: "../../packages/paykit/src/database/migrations",
  dbCredentials: {
    url: process.env.PAYKIT_DATABASE_URL!,
  },
  migrations: {
    schema: "public",
    table: "paykit_migrations",
  },
});
