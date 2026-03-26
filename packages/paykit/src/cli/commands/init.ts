import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";

import { templates } from "../templates/index";
import {
  defaultConfigPath,
  defaultRoutePath,
  detectPackageManager,
  isPackageInstalled,
  resolveImportPath,
} from "../utils/detect";

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateConfigFile(): string {
  return `import { stripe } from "@paykitjs/stripe";
import { createPayKit } from "paykitjs";
import { Pool } from "pg";

import * as plans from "./paykit.plans";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const paykit = createPayKit({
  database: pool,
  provider: stripe({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  }),
  plans,
});
`;
}

function generateRouteHandler(configPath: string, routePath: string, cwd: string): string {
  const configFullPath = path.join(cwd, configPath);
  const routeFullPath = path.join(cwd, routePath);
  const importPath = resolveImportPath(routeFullPath, configFullPath, cwd);

  return `import { paykitHandler } from "paykitjs/handlers/next";

import { paykit } from "${importPath}";

export const { GET, POST } = paykitHandler(paykit);
`;
}

function generateClientFile(configPath: string, clientPath: string, cwd: string): string {
  const configFullPath = path.join(cwd, configPath);
  const clientFullPath = path.join(cwd, clientPath);
  const importPath = resolveImportPath(clientFullPath, configFullPath, cwd);

  return `import { createPayKitClient } from "paykitjs/client";

import type { paykit } from "${importPath}";

export const paykitClient = createPayKitClient<typeof paykit>();
`;
}

function getEnvVarsToAdd(cwd: string): { key: string; comment: string }[] {
  const envPath = path.join(cwd, ".env");
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  const vars = [
    { key: "DATABASE_URL", comment: "# PostgreSQL connection string" },
    { key: "STRIPE_SECRET_KEY", comment: "# Stripe secret key (sk_test_... or sk_live_...)" },
    { key: "STRIPE_WEBHOOK_SECRET", comment: "# Stripe webhook secret (whsec_...)" },
  ];

  return vars.filter((v) => !existing.includes(`${v.key}=`));
}

function writeEnvVars(cwd: string, vars: { key: string; comment: string }[]): void {
  const envPath = path.join(cwd, ".env");
  let content = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";

  for (const v of vars) {
    if (content.length > 0 && !content.endsWith("\n")) {
      content += "\n";
    }
    content += `${v.comment}\n${v.key}=\n`;
  }

  fs.writeFileSync(envPath, content);
}

interface FileToWrite {
  path: string;
  content: string;
}

async function initAction(options: { cwd: string }): Promise<void> {
  const cwd = path.resolve(options.cwd);

  p.intro("paykit init");
  p.log.info("Welcome to PayKit! Let's set up billing.");

  // ── Collect answers ──

  // 1. Provider selection
  const provider = await p.select({
    message: "Select a payment provider",
    options: [
      { value: "stripe", label: "Stripe" },
      { value: "polar", label: "Polar", hint: "coming soon", disabled: true },
      { value: "creem", label: "Creem", hint: "coming soon", disabled: true },
    ],
  });

  if (p.isCancel(provider)) {
    p.cancel("Aborted");
    process.exit(0);
  }

  // 2. Config path
  const configDefault = defaultConfigPath(cwd);
  const configPath = await p.text({
    message: "Where should we create the PayKit config?",
    defaultValue: configDefault,
    placeholder: configDefault,
  });

  if (p.isCancel(configPath)) {
    p.cancel("Aborted");
    process.exit(0);
  }

  // 3. Route handler
  const framework = await p.select({
    message: "Framework",
    options: [
      { value: "nextjs", label: "Next.js (App Router)" },
      { value: "other", label: "Other", hint: "not yet supported" },
    ],
  });

  if (p.isCancel(framework)) {
    p.cancel("Aborted");
    process.exit(0);
  }

  let routePath: string | null = null;
  if (framework === "nextjs") {
    const routeDefault = defaultRoutePath(cwd);
    const result = await p.text({
      message: "Route handler path",
      defaultValue: routeDefault,
      placeholder: routeDefault,
    });

    if (p.isCancel(result)) {
      p.cancel("Aborted");
      process.exit(0);
    }
    routePath = result;
  }

  // 4. Client
  const generateClient = await p.confirm({
    message: "Generate a PayKit client?",
  });

  if (p.isCancel(generateClient)) {
    p.cancel("Aborted");
    process.exit(0);
  }

  let clientPath: string | null = null;
  if (generateClient) {
    const clientDefault = "src/lib/paykit-client.ts";
    const result = await p.text({
      message: "Client file path",
      defaultValue: clientDefault,
      placeholder: clientDefault,
    });

    if (p.isCancel(result)) {
      p.cancel("Aborted");
      process.exit(0);
    }
    clientPath = result;
  }

  // 5. Products template
  const templateId = await p.select({
    message: "Select a pricing template",
    options: templates.map((t) => ({
      value: t.id,
      label: t.name,
      hint: t.hint,
    })),
  });

  if (p.isCancel(templateId)) {
    p.cancel("Aborted");
    process.exit(0);
  }

  // ── Execute ──

  // Install dependencies
  const packages = ["paykitjs", "@paykitjs/stripe"];
  const toInstall = packages.filter((pkg) => !isPackageInstalled(cwd, pkg));

  if (toInstall.length > 0) {
    const pm = detectPackageManager(cwd);
    const installCmd = pm === "npm" ? "npm install" : `${pm} add`;
    const spinner = p.spinner();
    spinner.start(`Installing ${toInstall.join(", ")}`);
    try {
      execSync(`${installCmd} ${toInstall.join(" ")}`, {
        cwd,
        stdio: "pipe",
        env: { ...process.env, NODE_ENV: "" },
      });
      spinner.stop(`Installed ${toInstall.join(", ")}`);
    } catch {
      spinner.stop("Could not install automatically");
      p.log.step(
        `Add to your package.json manually:\n  ${picocolors.dim(`${installCmd} ${toInstall.join(" ")}`)}`,
      );
    }
  } else {
    p.log.step("Dependencies already installed");
  }

  // Generate files
  const files: FileToWrite[] = [];
  const skipped: string[] = [];

  // Config
  const configFullPath = path.join(cwd, configPath);
  if (fs.existsSync(configFullPath)) {
    skipped.push(configPath);
  } else {
    files.push({ path: configPath, content: generateConfigFile() });
  }

  // Plans
  const template = templates.find((t) => t.id === templateId);
  if (template) {
    const plansPath = configPath.replace(/paykit\.ts$/, "paykit.plans.ts");
    const plansFullPath = path.join(cwd, plansPath);
    if (fs.existsSync(plansFullPath)) {
      skipped.push(plansPath);
    } else {
      files.push({ path: plansPath, content: template.content });
    }
  }

  // Route handler
  if (routePath) {
    const routeFullPath = path.join(cwd, routePath);
    if (fs.existsSync(routeFullPath)) {
      skipped.push(routePath);
    } else {
      files.push({ path: routePath, content: generateRouteHandler(configPath, routePath, cwd) });
    }
  }

  // Client
  if (clientPath) {
    const clientFullPath = path.join(cwd, clientPath);
    if (fs.existsSync(clientFullPath)) {
      skipped.push(clientPath);
    } else {
      files.push({ path: clientPath, content: generateClientFile(configPath, clientPath, cwd) });
    }
  }

  // Write all files
  for (const file of files) {
    const fullPath = path.join(cwd, file.path);
    ensureDir(fullPath);
    fs.writeFileSync(fullPath, file.content);
  }

  if (files.length > 0) {
    const fileList = files.map((f) => `  ${picocolors.dim(f.path)}`).join("\n");
    p.log.success(
      `Created ${String(files.length)} file${files.length === 1 ? "" : "s"}:\n${fileList}`,
    );
  }

  if (skipped.length > 0) {
    const skipList = skipped.map((f) => `  ${picocolors.dim(f)}`).join("\n");
    p.log.step(`Skipped (already exist):\n${skipList}`);
  }

  // Environment variables
  const envVars = getEnvVarsToAdd(cwd);
  if (envVars.length > 0) {
    writeEnvVars(cwd, envVars);
    const varList = envVars.map((v) => `  ${picocolors.dim(`${v.key}=`)}`).join("\n");
    p.log.success(`Added to .env:\n${varList}`);
  } else {
    p.log.step("Environment variables already configured");
  }

  // Manual setup note for non-Next.js
  if (framework === "other") {
    p.note(
      "See the docs for manual route handler setup:\nhttps://paykitjs.com/docs/setup",
      "Manual Setup",
    );
  }

  // Done
  p.note(
    `Fill in the variables in .env, then run:\n  ${picocolors.bold("paykitjs push")}\n\nFor local webhooks:\n  ${picocolors.dim("stripe listen --forward-to localhost:3000/api/paykit")}`,
    "Almost there!",
  );

  p.outro("Done");
}

export const initCommand = new Command("init")
  .description("Initialize PayKit in your project")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .action(initAction);
