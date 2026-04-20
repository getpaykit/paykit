import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";
import { default as Stripe } from "stripe";

process.env.PAYKIT_CLI = "1";

// Load env from repo root
config({ path: path.resolve(import.meta.dirname, "../../.env") });
config({ path: path.resolve(import.meta.dirname, "../../.env.local"), override: true });

const packageRoot = path.resolve(import.meta.dirname, "../../packages/paykit");
const createPayKitPath = path.resolve(packageRoot, "src/index.ts");
const stripePath = path.resolve(import.meta.dirname, "../../packages/stripe/src/index.ts");

export interface CliTestFixture {
  cwd: string;
  dbName: string;
  dbUrl: string;
  stripeClient: Stripe;
  writeConfig: (options: { includePro: boolean }) => Promise<void>;
  cleanup: () => Promise<void>;
}

/**
 * Creates a temp directory with a paykit.ts config pointing to a real
 * Postgres DB and real Stripe. Returns everything needed for cleanup.
 */
export async function createCliFixture(_globalKey: string): Promise<CliTestFixture> {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !webhookSecret) {
    throw new Error("STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set");
  }

  const stripeClient = new Stripe(secretKey);

  // Create a fresh test database
  const dbName = `paykit_cli_${String(Date.now())}`;
  const adminUrl = process.env.TEST_DATABASE_URL ?? "postgresql://localhost:5432/postgres";
  const adminPool = new Pool({ connectionString: adminUrl });
  await adminPool.query(`CREATE DATABASE "${dbName}"`);
  await adminPool.end();

  const dbUrl = adminUrl.replace(/\/[^/]*$/, `/${dbName}`);

  // Create temp directory with config
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paykit-cli-test-"));

  const configDir = cwd;
  const toImportPath = (targetPath: string) => {
    const relativePath = path.relative(configDir, targetPath);
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
  };

  const writeConfig = async (options: { includePro: boolean }) => {
    const lines = [
      `import { createPayKit, feature, plan } from ${JSON.stringify(toImportPath(createPayKitPath))};`,
      `import { stripe } from ${JSON.stringify(toImportPath(stripePath))};`,
      `import pg from "pg";`,
      "",
      `const pool = new pg.Pool({ connectionString: ${JSON.stringify(dbUrl)} });`,
      "",
      `const messagesFeature = feature({ id: "messages", type: "metered" });`,
      "",
      `const free = plan({`,
      `  id: "free",`,
      `  name: "Free",`,
      `  group: "base",`,
      `  default: true,`,
      `  includes: [messagesFeature({ limit: 50, reset: "month" })],`,
      `});`,
      "",
      `const pro = plan({`,
      `  id: "pro",`,
      `  name: "Pro",`,
      `  group: "base",`,
      `  price: { amount: 2000, interval: "month" },`,
      `  includes: [messagesFeature({ limit: 1000, reset: "month" })],`,
      `});`,
      "",
      `export const paykit = createPayKit({`,
      `  database: pool,`,
      `  provider: stripe({`,
      `    secretKey: ${JSON.stringify(secretKey)},`,
      `    webhookSecret: ${JSON.stringify(webhookSecret)},`,
      `  }),`,
      `  plans: { free${options.includePro ? ", pro" : ""} },`,
      `});`,
    ];

    await fs.writeFile(path.join(cwd, "paykit.ts"), lines.join("\n"));
  };

  await writeConfig({ includePro: true });

  const cleanup = async () => {
    // Clean up Stripe products created by push
    try {
      const products = await stripeClient.products.list({ limit: 100 });
      for (const product of products.data) {
        const paykitId = product.metadata.paykit_product_id;
        if (paykitId === "free" || paykitId === "pro") {
          // Archive prices first
          const prices = await stripeClient.prices.list({ product: product.id, limit: 100 });
          for (const price of prices.data) {
            if (price.active) {
              await stripeClient.prices.update(price.id, { active: false });
            }
          }
          await stripeClient.products.update(product.id, { active: false });
        }
      }
    } catch {
      // Best effort cleanup
    }

    // Drop the test database
    const cleanupPool = new Pool({ connectionString: adminUrl });
    await cleanupPool.query(`DROP DATABASE IF EXISTS "${dbName}"`).catch(() => {});
    await cleanupPool.end();

    // Remove temp directory
    await fs.rm(cwd, { force: true, recursive: true });
  };

  return { cleanup, cwd, dbName, dbUrl, stripeClient, writeConfig };
}
