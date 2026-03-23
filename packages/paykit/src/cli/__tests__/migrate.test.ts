import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createPGlitePool } from "../../test-utils/pglite-pool";
import { migrateAction } from "../commands/migrate";

const packageRoot = path.resolve(import.meta.dirname, "../../..");
const createPayKitPath = path.resolve(packageRoot, "src/index.ts");
const mockProviderPath = path.resolve(packageRoot, "src/test-utils/mock-provider.ts");
const pglitePoolPath = path.resolve(packageRoot, "src/test-utils/pglite-pool.ts");

const temporaryDirectories: string[] = [];
const temporaryGlobalKeys: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryGlobalKeys.splice(0).map(async (globalKey) => {
      const value = (globalThis as Record<string, unknown>)[globalKey];
      if (value && typeof value === "object" && "end" in value) {
        try {
          await (value as { end: () => Promise<void> }).end();
        } catch {}
      }
      Reflect.deleteProperty(globalThis, globalKey);
    }),
  );
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { force: true, recursive: true })),
  );
});

describe("paykit migrate", () => {
  it("should discover paykit.ts and apply migrations", async () => {
    const fixture = await createFixture({
      exportStyle: "named",
      filePath: "paykit.ts",
      globalKey: "__paykit_cli_named",
    });

    await migrateAction({ cwd: fixture.cwd });

    const pool = createPGlitePool(fixture.databasePath);
    const result = await pool.query(
      `
        select distinct table_name
        from information_schema.tables
        where table_name in ('paykit_customer', 'paykit_payment', 'paykit_product', 'paykit_migrations')
        order by table_name
      `,
    );

    expect(result.rows.map((row) => (row as { table_name: string }).table_name)).toEqual([
      "paykit_customer",
      "paykit_migrations",
      "paykit_payment",
      "paykit_product",
    ]);
    await pool.end();
  }, 15_000);

  it("should support an explicit --config path and default export", async () => {
    const fixture = await createFixture({
      exportStyle: "default",
      filePath: "config/paykit.config.ts",
      globalKey: "__paykit_cli_default",
    });

    await migrateAction({
      config: fixture.filePath,
      cwd: fixture.cwd,
    });

    const pool = createPGlitePool(fixture.databasePath);
    const result = await pool.query("select count(*)::int as count from public.paykit_migrations");
    expect((result.rows[0] as { count: number }).count).toBe(2);
    await pool.end();
  }, 15_000);

  it("should fall back to paykit.config.ts and keep repeated runs idempotent", async () => {
    const fixture = await createFixture({
      exportStyle: "named",
      filePath: "paykit.config.ts",
      globalKey: "__paykit_cli_fallback",
    });

    await migrateAction({ cwd: fixture.cwd });
    await migrateAction({ cwd: fixture.cwd });

    const pool = createPGlitePool(fixture.databasePath);
    const result = await pool.query("select count(*)::int as count from public.paykit_migrations");
    expect((result.rows[0] as { count: number }).count).toBe(2);
    await pool.end();
  }, 15_000);
});

async function createFixture({
  exportStyle,
  filePath,
  globalKey,
}: {
  exportStyle: "default" | "named";
  filePath: string;
  globalKey: string;
}) {
  const cwd = await fs.mkdtemp(path.join(process.cwd(), "paykit-migrate-test-"));
  temporaryDirectories.push(cwd);
  temporaryGlobalKeys.push(globalKey);
  const databasePath = path.join(cwd, ".paykit-test-db");

  await fs.mkdir(path.dirname(path.join(cwd, filePath)), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          baseUrl: ".",
          paths: {
            "@/*": ["./src/*"],
          },
        },
      },
      null,
      2,
    ),
  );
  await fs.mkdir(path.join(cwd, "src"), { recursive: true });
  await fs.writeFile(
    path.join(cwd, "src", "env.ts"),
    "export const env = { DATABASE_URL: 'postgres://ignored' };\n",
  );

  const configDirectory = path.dirname(path.join(cwd, filePath));
  const toImportPath = (targetPath: string) => {
    const relativePath = path.relative(configDirectory, targetPath);
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  };

  const exportLine =
    exportStyle === "default"
      ? "export default createPayKit({ database: pool, provider: mockProvider() });\n"
      : "export const paykit = createPayKit({ database: pool, provider: mockProvider() });\n";

  await fs.writeFile(
    path.join(cwd, filePath),
    [
      `import { createPayKit } from ${JSON.stringify(toImportPath(createPayKitPath))};`,
      `import { mockProvider } from ${JSON.stringify(toImportPath(mockProviderPath))};`,
      `import { createPGlitePool } from ${JSON.stringify(toImportPath(pglitePoolPath))};`,
      'import { env } from "@/env";',
      "",
      `const globalKey = ${JSON.stringify(globalKey)};`,
      `const databasePath = ${JSON.stringify(databasePath)};`,
      "const storedPool = (globalThis as Record<string, unknown>)[globalKey] as ReturnType<typeof createPGlitePool> | undefined;",
      "const pool = storedPool && !storedPool.closed ? storedPool : createPGlitePool(databasePath);",
      "(globalThis as Record<string, unknown>)[globalKey] = pool;",
      "void env.DATABASE_URL;",
      exportLine,
    ].join("\n"),
  );

  return {
    cwd,
    databasePath,
    filePath,
    globalKey,
  };
}
