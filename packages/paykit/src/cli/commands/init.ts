import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

import fs from "node:fs";
import path from "node:path";

import * as p from "@clack/prompts";
import { Command } from "commander";
import picocolors from "picocolors";

import type { Framework } from "../configs/frameworks.config";
import { templates } from "../templates/index";
import {
  defaultConfigPath,
  detectBetterAuth,
  detectFramework,
  detectNextJsRouterPath,
  detectPackageManager,
  getDlxPrefix,
  getExecPrefix,
  getInstallCommand,
  isPackageInstalled,
  resolveImportPath,
} from "../utils/detect";
import {
  createEnvFile,
  getEnvFiles,
  getMissingEnvVars,
  parseEnvFiles,
  updateEnvFiles,
} from "../utils/env";
import { capture } from "../utils/telemetry";

function ensureDir(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

const POSSIBLE_CONFIG_PATHS = buildPossiblePaths(["paykit.ts", "paykit.config.ts"]);
const POSSIBLE_CLIENT_PATHS = buildPossiblePaths(["paykit-client.ts"]);
type InitProvider = "stripe" | "polar";

function buildPossiblePaths(basePaths: string[]): string[] {
  const dirs = ["", "lib/", "server/", "utils/"];
  const withDirs = dirs.flatMap((dir) => basePaths.map((p) => `${dir}${p}`));
  return [...withDirs, ...withDirs.map((p) => `src/${p}`)];
}

function findExistingFile(cwd: string, candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(path.join(cwd, candidate))) {
      return candidate;
    }
  }
  return null;
}

function detectExistingProvider(cwd: string, configPath: string | null): InitProvider | null {
  if (!configPath) return null;

  const content = fs.readFileSync(path.join(cwd, configPath), "utf8");
  if (content.includes("@paykitjs/polar") || /provider:\s*polar\s*\(/.test(content)) {
    return "polar";
  }
  if (content.includes("@paykitjs/stripe") || /provider:\s*stripe\s*\(/.test(content)) {
    return "stripe";
  }

  return null;
}

function providerImport(provider: InitProvider): string {
  return provider === "polar"
    ? `import { polar } from "@paykitjs/polar";`
    : `import { stripe } from "@paykitjs/stripe";`;
}

function providerConfig(provider: InitProvider): string {
  if (provider === "polar") {
    return `polar({
    accessToken: process.env.POLAR_ACCESS_TOKEN!,
    webhookSecret: process.env.POLAR_WEBHOOK_SECRET!,
    server: process.env.POLAR_SERVER === "sandbox" ? "sandbox" : "production",
  })`;
  }

  return `stripe({
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  })`;
}

function buildIdentifyBlock(includeIdentify: boolean, useBetterAuthIdentify: string | null) {
  const identifyBlock = !includeIdentify
    ? ""
    : useBetterAuthIdentify
      ? `
identify: async (request) => {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return null;
  return {
    customerId: session.user.id,
    email: session.user.email,
    name: session.user.name,
  };
},`
      : `
identify: async (request) => {
  // Replace with your auth logic, for example:
  // const session = await auth.api.getSession({ headers: request.headers });
  // if (!session) return null;
  // return {
  //   customerId: session.user.id,
  //   email: session.user.email,
  //   name: session.user.name,
  // };
  return null;
},`;

  return identifyBlock;
}

function generateConfigFile(
  templateId: string,
  includeIdentify: boolean,
  useBetterAuthIdentify: string | null,
  provider: InitProvider,
): string {
  const productImports =
    templateId === "saas-starter"
      ? ["free", "pro"]
      : templateId === "usage-based"
        ? ["free", "pro"]
        : [];

  const productsLine = productImports.length
    ? `\n  products: [${productImports.join(", ")}],`
    : "\n  products: [],";
  const importLine = productImports.length
    ? `\nimport { ${productImports.join(", ")} } from "./paykit-products";`
    : "";

  const identifyBlock = buildIdentifyBlock(includeIdentify, useBetterAuthIdentify);

  return `${providerImport(provider)}
import { createPayKit } from "paykitjs";${importLine}
${includeIdentify && useBetterAuthIdentify ? `import { auth } from "${useBetterAuthIdentify}";` : ""}

export const paykit = createPayKit({
  database: process.env.DATABASE_URL!,
  provider: ${providerConfig(provider)},${productsLine}${identifyBlock}
});
`;
}

function detectExistingProductsModule(content: string): string[] | null {
  const namedExports = Array.from(
    content.matchAll(/export const\s+([a-zA-Z0-9_]+)\s*=/g),
    (match) => {
      const exportName = match[1];
      return exportName ?? "";
    },
  ).filter((exportName) => exportName.length > 0);
  if (namedExports.length > 0) {
    return namedExports;
  }

  const reExportMatch = content.match(/export\s*\{([^}]+)\}/);
  if (!reExportMatch) {
    return null;
  }

  const reExportList = reExportMatch[1] ?? "";

  return reExportList
    .split(",")
    .map((part) => {
      const aliases = part
        .trim()
        .split(/\s+as\s+/i)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
      return aliases[1] ?? aliases[0] ?? "";
    })
    .filter((part): part is string => Boolean(part));
}

function generateConfigFileFromProductsModule(
  productNames: string[],
  includeIdentify: boolean,
  useBetterAuthIdentify: string | null,
  provider: InitProvider,
  productsImportPath = "./paykit-products",
): string {
  const uniqueProductNames = Array.from(new Set(productNames));
  const productsLine = uniqueProductNames.length
    ? `\n  products: [${uniqueProductNames.join(", ")}],`
    : "\n  products: [],";
  const importLine = uniqueProductNames.length
    ? `\nimport { ${uniqueProductNames.join(", ")} } from "${productsImportPath}";`
    : "";

  const identifyBlock = buildIdentifyBlock(includeIdentify, useBetterAuthIdentify);

  return `${providerImport(provider)}
import { createPayKit } from "paykitjs";${importLine}
${includeIdentify && useBetterAuthIdentify ? `import { auth } from "${useBetterAuthIdentify}";` : ""}

export const paykit = createPayKit({
  database: process.env.DATABASE_URL!,
  provider: ${providerConfig(provider)},${productsLine}${identifyBlock}
});
`;
}

function generateRouteHandler(
  configPath: string,
  routePath: string,
  cwd: string,
  framework: Framework,
): string {
  if (!framework.routeHandler) return "";

  const importPath = resolveImportPath(routePath, configPath, cwd, framework);

  let code: string = framework.routeHandler.code;
  const importPatterns = [
    /from\s+["']@\/[^"']+["']/,
    /from\s+["']~\/[^"']+["']/,
    /from\s+["']\$lib\/[^"']+["']/,
    /from\s+["']\.\/[^"']+["']/,
    /from\s+["']\.\.\/[^"']+["']/,
  ];

  for (const pattern of importPatterns) {
    const replaced = code.replace(pattern, `from "${importPath}"`);
    if (replaced !== code) {
      code = replaced;
      break;
    }
  }

  return code + "\n";
}

function generateClientFile(
  configPath: string,
  clientPath: string,
  cwd: string,
  framework: Framework,
): string {
  const importPath = resolveImportPath(clientPath, configPath, cwd, framework);
  const clientImport = framework.authClient?.importPath ?? "paykitjs/client";

  return `import { createPayKitClient } from "${clientImport}";
import type { paykit } from "${importPath}";

export const paykitClient = createPayKitClient<typeof paykit>();
`;
}

interface FileToWrite {
  path: string;
  content: string;
}

const ENV_VARS = [{ key: "DATABASE_URL", line: "DATABASE_URL=" }];

const PROVIDER_ENV_VARS: Record<InitProvider, { key: string; line: string }[]> = {
  polar: [
    { key: "POLAR_ACCESS_TOKEN", line: "POLAR_ACCESS_TOKEN=" },
    { key: "POLAR_WEBHOOK_SECRET", line: "POLAR_WEBHOOK_SECRET=" },
    { key: "POLAR_SERVER", line: "POLAR_SERVER=sandbox" },
  ],
  stripe: [
    { key: "STRIPE_SECRET_KEY", line: "STRIPE_SECRET_KEY=" },
    { key: "STRIPE_WEBHOOK_SECRET", line: "STRIPE_WEBHOOK_SECRET=" },
  ],
};

function frameworksList(): string {
  const c = picocolors.cyan;
  const dot = picocolors.dim(" · ");
  const row1 = ["Next.js", "Tanstack Start", "Hono", "Express", "Elysia"].map(c).join(dot);
  const row2 = [
    "Remix",
    "Astro",
    "SvelteKit",
    "Nuxt",
    "Solid Start",
    "React Router",
    "Fastify",
    "Nitro",
  ]
    .map(c)
    .join(dot);
  return [`   ${picocolors.bold("Supported frameworks:")}`, `     ${row1}`, `     ${row2}`].join(
    "\n",
  );
}

async function initAction(options: { cwd: string; defaults: boolean }): Promise<void> {
  const cwd = path.resolve(options.cwd);
  const useDefaults = options.defaults;

  if (!fs.existsSync(path.join(cwd, "package.json"))) {
    p.outro(
      [
        picocolors.red("PayKit must be initialized inside a project."),
        "",
        "   No package.json found in this directory.",
        "",
        frameworksList(),
      ].join("\n"),
    );
    process.exit(1);
  }

  const detectedFramework = detectFramework(cwd);

  if (!detectedFramework) {
    p.outro(
      [
        picocolors.red("Could not detect a supported framework."),
        "",
        "   Make sure you're running this inside your app directory, not the monorepo root.",
        "",
        frameworksList(),
      ].join("\n"),
    );
    process.exit(1);
  }

  p.intro(picocolors.cyan("Welcome to PayKit! Let's set up billing."));

  let framework: Framework = detectedFramework;
  p.log.step(`Detected framework: ${picocolors.bold(framework.name)}`);

  // Check what already exists
  const existingConfig = findExistingFile(cwd, POSSIBLE_CONFIG_PATHS);
  const existingClient = findExistingFile(cwd, POSSIBLE_CLIENT_PATHS);
  const existingProvider = detectExistingProvider(cwd, existingConfig);
  const usesBetterAuth = detectBetterAuth(cwd);
  const existingBetterAuthConfig = findExistingFile(cwd, [
    "src/server/better-auth/config.ts",
    "src/lib/auth.ts",
  ]);

  let provider: string | symbol = "stripe";
  if (existingProvider) {
    provider = existingProvider;
  } else if (!existingConfig && !useDefaults) {
    provider = await p.select({
      message: "Select payment provider",
      options: [
        { value: "stripe", label: "Stripe" },
        { value: "polar", label: "Polar" },
        { value: "creem", label: "Creem", hint: "coming soon", disabled: true },
      ],
    });

    if (p.isCancel(provider)) {
      p.cancel("Aborted");
      process.exit(0);
    }
  }

  const selectedProvider: InitProvider = provider === "polar" ? "polar" : "stripe";
  const envVars = [...ENV_VARS, ...PROVIDER_ENV_VARS[selectedProvider]];
  const envLineByKey = new Map(envVars.map((v) => [v.key, v.line]));
  const envFiles = getEnvFiles(cwd);
  const envVarsToAdd = envVars.map((v) => v.key);

  if (envFiles.length > 0) {
    const parsed = parseEnvFiles(envFiles);
    const missingPerFile = getMissingEnvVars(parsed, envVarsToAdd);

    if (missingPerFile.length > 0) {
      for (const { file, missing } of missingPerFile) {
        if (missing.length === 0) continue;
        updateEnvFiles(
          [file],
          missing.map((key) => envLineByKey.get(key) ?? `${key}=`),
        );
      }

      const allMissing = [...new Set(missingPerFile.flatMap((f) => f.missing))];
      const varList = allMissing.map((v) => `  ${picocolors.dim(`${v}=`)}`).join("\n");
      p.log.success(`Added missing env vars:\n${varList}`);
    }
  } else {
    const lines = envVars.map((v) => v.line);
    createEnvFile(cwd, lines);
    p.log.success(`Created .env with ${String(envVars.length)} variables`);
  }

  // For Next.js, detect App Router vs Pages Router
  if (framework.id === "next" && framework.routeHandler) {
    const routeHandlerPath = detectNextJsRouterPath(cwd);
    framework = {
      ...framework,
      routeHandler: {
        ...framework.routeHandler,
        path: routeHandlerPath,
      },
    } as Framework;
  }

  const configDefault = defaultConfigPath(cwd);
  let configPath: string;
  if (existingConfig) {
    configPath = existingConfig;
  } else if (useDefaults) {
    configPath = configDefault;
  } else {
    const result = await p.text({
      message: "Path for the PayKit instance",
      defaultValue: configDefault,
      placeholder: configDefault,
      validate: (value) => {
        const v = value || configDefault;
        if (!v.endsWith("/paykit.ts") && v !== "paykit.ts") return "Filename must be paykit.ts";
        if (v.startsWith("/")) return "Path must be relative";
        return undefined;
      },
    });

    if (p.isCancel(result)) {
      p.cancel("Aborted");
      process.exit(0);
    }
    configPath = result;
  }

  let routePath: string | null = null;
  if (framework.routeHandler) {
    const routeDefault = framework.routeHandler.path;
    const routeFullPath = path.join(cwd, routeDefault);

    if (!fs.existsSync(routeFullPath)) {
      if (useDefaults) {
        routePath = routeDefault;
      } else {
        const result = await p.text({
          message: "Path for the route handler",
          defaultValue: routeDefault,
          placeholder: routeDefault,
        });

        if (p.isCancel(result)) {
          p.cancel("Aborted");
          process.exit(0);
        }
        routePath = result;
      }
    }
  } else if (!existingConfig) {
    p.note(
      "See the docs for manual route handler setup:\nhttps://paykitjs.com/docs/setup",
      "Manual Setup",
    );
  }

  let clientPath: string | null = null;
  if (!existingClient && framework.authClient) {
    const configDir = path.dirname(configPath);
    const clientDefault = path.join(configDir, "paykit-client.ts");

    if (useDefaults) {
      clientPath = clientDefault;
    } else {
      const generateClient = await p.confirm({
        message: "Wanna use PayKit client caller?",
      });

      if (p.isCancel(generateClient)) {
        p.cancel("Aborted");
        process.exit(0);
      }

      if (generateClient) {
        const result = await p.text({
          message: "Path for the client instance",
          defaultValue: clientDefault,
          placeholder: clientDefault,
        });

        if (p.isCancel(result)) {
          p.cancel("Aborted");
          process.exit(0);
        }
        clientPath = result;
      }
    }
  }

  const productsPath = configPath.replace(/paykit(\.config)?\.ts$/, "paykit-products.ts");
  const productsFullPath = path.join(cwd, productsPath);
  const legacyProductsPath = configPath.replace(/paykit(\.config)?\.ts$/, "paykit-plans.ts");
  const legacyProductsFullPath = path.join(cwd, legacyProductsPath);
  let templateId: string | symbol = "saas-starter";
  const hasProductsModule = fs.existsSync(productsFullPath);
  const hasLegacyProductsModule = fs.existsSync(legacyProductsFullPath);
  const existingProductsModule = hasProductsModule
    ? detectExistingProductsModule(fs.readFileSync(productsFullPath, "utf8"))
    : hasLegacyProductsModule
      ? detectExistingProductsModule(fs.readFileSync(legacyProductsFullPath, "utf8"))
      : null;
  const existingProductsImportPath = hasProductsModule
    ? "./paykit-products"
    : hasLegacyProductsModule
      ? "./paykit-plans"
      : "./paykit-products";

  if ((hasProductsModule || hasLegacyProductsModule) && existingProductsModule === null) {
    p.cancel(
      `Could not parse ${hasProductsModule ? productsPath : legacyProductsPath}. Update the module exports or regenerate it before running init again.`,
    );
    process.exit(1);
  }

  if (!hasProductsModule && !hasLegacyProductsModule && !useDefaults) {
    templateId = await p.select({
      message: "Select pricing template",
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
  }

  const providerPackage = selectedProvider === "polar" ? "@paykitjs/polar" : "@paykitjs/stripe";
  const packages = ["paykitjs", providerPackage];
  const toInstall = packages.filter((pkg) => !isPackageInstalled(cwd, pkg));

  if (toInstall.length > 0) {
    const pm = detectPackageManager(cwd);
    const installCmd = getInstallCommand(pm, toInstall);
    const spinner = p.spinner();
    spinner.start(`Installing ${toInstall.join(", ")} via ${pm}`);
    try {
      await execAsync(installCmd, {
        cwd,
        env: { ...process.env, NODE_ENV: "" },
      });
      spinner.stop(`Installed ${toInstall.join(", ")} via ${pm}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      spinner.stop(picocolors.yellow("Could not install dependencies"));
      p.log.message(`  ${picocolors.dim(msg)}\n  Run manually: ${picocolors.bold(installCmd)}`);
    }
  }

  const files: FileToWrite[] = [];

  if (usesBetterAuth && existingBetterAuthConfig) {
    p.log.step(`Detected Better Auth: ${picocolors.bold(existingBetterAuthConfig)}`);
  }

  // Config
  if (!existingConfig || hasLegacyProductsModule) {
    files.push({
      path: configPath,
      content: existingProductsModule
        ? generateConfigFileFromProductsModule(
            existingProductsModule,
            clientPath !== null || usesBetterAuth,
            usesBetterAuth && existingBetterAuthConfig
              ? resolveImportPath(configPath, existingBetterAuthConfig, cwd, framework)
              : null,
            selectedProvider,
            existingProductsImportPath,
          )
        : generateConfigFile(
            templateId as string,
            clientPath !== null || usesBetterAuth,
            usesBetterAuth && existingBetterAuthConfig
              ? resolveImportPath(configPath, existingBetterAuthConfig, cwd, framework)
              : null,
            selectedProvider,
          ),
    });
  }

  // Plans
  if (!hasProductsModule && !hasLegacyProductsModule) {
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      files.push({ path: productsPath, content: template.content });
    }
  }

  // Route handler
  if (routePath) {
    files.push({
      path: routePath,
      content: generateRouteHandler(configPath, routePath, cwd, framework),
    });
  }

  // Client
  if (clientPath) {
    files.push({
      path: clientPath,
      content: generateClientFile(configPath, clientPath, cwd, framework),
    });
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

  capture("cli_command", {
    command: "init",
    provider: provider as string,
    framework: framework.id,
    template: templateId as string,
    filesCreated: files.length,
  });

  const pm = detectPackageManager(cwd);
  const exec = getExecPrefix(pm);
  const c = picocolors.cyan;
  const b = picocolors.bold;
  const webhookCommand =
    selectedProvider === "polar"
      ? "polar listen http://localhost:3000/paykit/webhook"
      : "stripe listen --forward-to localhost:3000/paykit/webhook";

  const isRerun = files.length === 0;
  const heading = isRerun
    ? picocolors.green("PayKit is already initialized!")
    : picocolors.green("PayKit setup completed!");

  p.outro(
    [
      heading,
      "",
      `   ${b("Next steps")}`,
      `   ${c("1.")} Fill in .env variables`,
      `   ${c("2.")} Sync your products ${b(`${exec} paykitjs push`)}`,
      "",
      `   You're good to use PayKit!`,
      "",
      `   ${b("Commands")}`,
      `   ${c("•")} Check status: ${b(`${exec} paykitjs status`)}`,
      `   ${c("•")} Sync updated products: ${b(`${exec} paykitjs push`)}`,
      `   ${c("•")} Add AI skills: ${b(`${getDlxPrefix(pm)} skills add getpaykit/skills`)}`,
      `   ${c("•")} Forward dev webhooks: ${b(webhookCommand)}`,
      "",
      `   Please star us on github ${c("<3")}`,
      `   ${c("https://paykit.sh/github")}`,
    ].join("\n"),
  );
}

export const initCommand = new Command("init")
  .description("Initialize PayKit in your project")
  .option(
    "-c, --cwd <cwd>",
    "the working directory. defaults to the current directory.",
    process.cwd(),
  )
  .option("-y, --defaults", "skip prompts and use defaults", false)
  .action(initAction);
