import fs from "node:fs/promises";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createContext } from "../../core/context";
import { syncProducts } from "../../services/product-sync-service";
import { createPGlitePool } from "../../test-utils/pglite-pool";
import { getPayKitConfig } from "../utils/get-config";
import { runPayKitMigrations } from "../utils/run-migrations";

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

describe("paykit sync-products", () => {
  it("should sync exported plans into the catalog tables", async () => {
    const fixture = await createFixture({
      filePath: "paykit.ts",
      globalKey: "__paykit_cli_sync_products",
    });

    const config = await getPayKitConfig({ cwd: fixture.cwd });
    try {
      await runPayKitMigrations(config);
      const ctx = await createContext(config.options);
      await syncProducts(ctx);
      await syncProducts(ctx);
    } finally {
      await config.options.database.end();
    }

    const pool = createPGlitePool(fixture.databasePath);
    const counts = await pool.query(`
      select
        (select count(*)::int from paykit_feature) as feature_count,
        (select count(*)::int from paykit_product) as product_count,
        (select count(*)::int from paykit_price) as price_count,
        (select count(*)::int from paykit_product_feature) as product_feature_count,
        (select count(*)::int from paykit_provider_product) as provider_product_count,
        (select count(*)::int from paykit_provider_price) as provider_price_count
    `);
    const rows = await pool.query(`
      select
        id,
        name,
        "group",
        is_default
      from paykit_product
      order by id
    `);

    expect(counts.rows[0]).toEqual({
      feature_count: 2,
      price_count: 1,
      product_count: 2,
      product_feature_count: 3,
      provider_price_count: 1,
      provider_product_count: 1,
    });
    expect(rows.rows).toEqual([
      {
        group: "base",
        id: "free",
        is_default: true,
        name: "Free",
      },
      {
        group: "base",
        id: "pro",
        is_default: false,
        name: "Pro",
      },
    ]);

    await pool.end();
  }, 15_000);
});

async function createFixture({ filePath, globalKey }: { filePath: string; globalKey: string }) {
  const cwd = await fs.mkdtemp(path.join(process.cwd(), "paykit-sync-products-test-"));
  temporaryDirectories.push(cwd);
  temporaryGlobalKeys.push(globalKey);
  const databasePath = path.join(cwd, ".paykit-test-db");

  const configDirectory = path.dirname(path.join(cwd, filePath));
  await fs.mkdir(configDirectory, { recursive: true });

  const toImportPath = (targetPath: string) => {
    const relativePath = path.relative(configDirectory, targetPath);
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  };

  await fs.writeFile(
    path.join(cwd, filePath),
    [
      `import { createPayKit, feature, plan } from ${JSON.stringify(toImportPath(createPayKitPath))};`,
      `import { mockProvider } from ${JSON.stringify(toImportPath(mockProviderPath))};`,
      `import { createPGlitePool } from ${JSON.stringify(toImportPath(pglitePoolPath))};`,
      "",
      `const globalKey = ${JSON.stringify(globalKey)};`,
      `const databasePath = ${JSON.stringify(databasePath)};`,
      "const storedPool = (globalThis as Record<string, unknown>)[globalKey] as ReturnType<typeof createPGlitePool> | undefined;",
      "const pool = storedPool && !storedPool.closed ? storedPool : createPGlitePool(databasePath);",
      "(globalThis as Record<string, unknown>)[globalKey] = pool;",
      "",
      'const messagesFeature = feature({ id: "messages", type: "metered" });',
      'const proModelsFeature = feature({ id: "pro_models", type: "boolean" });',
      "",
      'const free = plan({ id: "free", group: "base", default: true, includes: [messagesFeature({ limit: 50, reset: "month" })] });',
      'const pro = plan({ id: "pro", group: "base", price: { amount: 20, interval: "month" }, includes: [messagesFeature({ limit: 1000, reset: "month" }), proModelsFeature()] });',
      "",
      "export const paykit = createPayKit({",
      "  database: pool,",
      "  provider: mockProvider(),",
      "  plans: { free, pro },",
      "});",
    ].join("\n"),
  );

  return {
    cwd,
    databasePath,
  };
}
