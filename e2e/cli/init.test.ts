import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((dir) => fs.rm(dir, { force: true, recursive: true })),
  );
});

async function createInitFixture() {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "paykit-init-test-"));
  temporaryDirectories.push(cwd);

  // Create a minimal package.json so init can detect the project
  await fs.writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify({ name: "test-app", dependencies: {} }, null, 2),
  );

  // Create src directory (Next.js-like structure)
  await fs.mkdir(path.join(cwd, "src", "app", "api", "paykit", "[...slug]"), { recursive: true });
  await fs.mkdir(path.join(cwd, "src", "lib"), { recursive: true });

  return { cwd };
}

describe("paykitjs init", () => {
  it("should generate config, products, route handler, and .env", async () => {
    const { cwd } = await createInitFixture();

    const configPath = "src/lib/paykit.ts";
    const productsPath = "src/lib/paykit-products.ts";
    const routePath = "src/app/api/paykit/[...slug]/route.ts";
    const envPath = ".env";

    // Write config file
    const configContent = `import { createPayKit } from "paykitjs";
import { free, pro } from "./paykit-products";

export const paykit = createPayKit({
  database: process.env.DATABASE_URL!,
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  products: [free, pro],
  identify: async (request) => {
    return null;
  },
});
`;

    const configFullPath = path.join(cwd, configPath);
    await fs.mkdir(path.dirname(configFullPath), { recursive: true });
    await fs.writeFile(configFullPath, configContent);

    const written = await fs.readFile(configFullPath, "utf-8");
    expect(written).toContain("createPayKit");
    expect(written).toContain("stripe:");
    expect(written).toContain("paykit-products");
    expect(written).toContain("products: [free, pro]");

    // Write plans file
    const productsContent = `import { plan } from "paykitjs";

export const free = plan({
  id: "free",
  name: "Free",
  group: "base",
  default: true,
});

export const pro = plan({
  id: "pro",
  name: "Pro",
  group: "base",
  price: { amount: 29, interval: "month" },
});
`;
    await fs.writeFile(path.join(cwd, productsPath), productsContent);

    const writtenProducts = await fs.readFile(path.join(cwd, productsPath), "utf-8");
    expect(writtenProducts).toContain('id: "free"');
    expect(writtenProducts).toContain('id: "pro"');

    // Write route handler
    const routeContent = `import { paykitHandler } from "paykitjs/handlers/next";
import { paykit } from "@/lib/paykit";

export const { GET, POST } = paykitHandler(paykit);
`;
    const routeFullPath = path.join(cwd, routePath);
    await fs.mkdir(path.dirname(routeFullPath), { recursive: true });
    await fs.writeFile(routeFullPath, routeContent);

    const writtenRoute = await fs.readFile(routeFullPath, "utf-8");
    expect(writtenRoute).toContain("paykitHandler");
    expect(writtenRoute).toContain("GET, POST");

    // Write .env
    const envContent = `DATABASE_URL=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
`;
    await fs.writeFile(path.join(cwd, envPath), envContent);

    const writtenEnv = await fs.readFile(path.join(cwd, envPath), "utf-8");
    expect(writtenEnv).toContain("DATABASE_URL=");
    expect(writtenEnv).toContain("STRIPE_SECRET_KEY=");
    expect(writtenEnv).toContain("STRIPE_WEBHOOK_SECRET=");
  });

  it("should not overwrite existing config files", async () => {
    const { cwd } = await createInitFixture();

    const configPath = path.join(cwd, "src", "lib", "paykit.ts");
    await fs.mkdir(path.dirname(configPath), { recursive: true });
    await fs.writeFile(configPath, "// existing config\n");

    const content = await fs.readFile(configPath, "utf-8");
    expect(content).toBe("// existing config\n");
  });

  it("should not duplicate env vars that already exist", async () => {
    const { cwd } = await createInitFixture();

    const envPath = path.join(cwd, ".env");
    await fs.writeFile(envPath, "DATABASE_URL=postgres://localhost/test\n");

    const content = await fs.readFile(envPath, "utf-8");
    expect(content).toContain("DATABASE_URL=postgres://localhost/test");
    expect(content.split("DATABASE_URL=").length - 1).toBe(1);
  });
});
