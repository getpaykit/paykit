import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { createJiti } from "jiti";
import * as ts from "typescript";

import { isPayKitInstance } from "../../core/create-paykit";
import type { PayKitOptions } from "../../types/options";

const CONFIG_FILENAMES = [
  "paykit.ts",
  "paykit.tsx",
  "paykit.config.ts",
  "paykit.config.tsx",
  "paykit/index.ts",
  "paykit/index.tsx",
  "paykit.js",
  "paykit.jsx",
  "paykit.config.js",
  "paykit.config.jsx",
  "paykit/index.js",
  "paykit/index.jsx",
];

const CONFIG_DIRS = [
  "",
  "lib/server",
  "server/paykit",
  "server",
  "paykit",
  "lib",
  "src",
  "src/lib",
  "src/server",
  "app",
];

const possiblePayKitConfigPaths = CONFIG_DIRS.flatMap((dir) =>
  CONFIG_FILENAMES.map((name) => (dir ? `${dir}/${name}` : name)),
);

function resolveReferencePath(configDir: string, refPath: string): string {
  const resolvedPath = path.resolve(configDir, refPath);
  if (refPath.endsWith(".json")) {
    return resolvedPath;
  }

  if (fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }

  return path.resolve(configDir, refPath, "tsconfig.json");
}

function getPathAliasesRecursive(
  tsconfigPath: string,
  visited = new Set<string>(),
): Record<string, string> {
  if (visited.has(tsconfigPath) || !fs.existsSync(tsconfigPath)) {
    return {};
  }

  visited.add(tsconfigPath);
  const readResult = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (readResult.error) {
    throw new Error(ts.flattenDiagnosticMessageText(readResult.error.messageText, "\n"));
  }

  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(tsconfigPath),
  );
  const result: Record<string, string> = {};
  const paths = parsed.options.paths ?? {};
  const baseUrl = parsed.options.baseUrl ?? path.dirname(tsconfigPath);

  for (const [alias, aliasPaths] of Object.entries(paths)) {
    for (const aliasPath of aliasPaths) {
      const finalAlias = alias.endsWith("*") ? alias.slice(0, -1) : alias;
      const finalAliasPath = aliasPath.endsWith("*") ? aliasPath.slice(0, -1) : aliasPath;
      result[finalAlias] = path.resolve(baseUrl, finalAliasPath);
    }
  }

  const references = readResult.config.references as Array<{ path: string }> | undefined;
  if (!references) {
    return result;
  }

  for (const reference of references) {
    const nextPath = resolveReferencePath(path.dirname(tsconfigPath), reference.path);
    const referencedAliases = getPathAliasesRecursive(nextPath, visited);
    for (const [alias, aliasPath] of Object.entries(referencedAliases)) {
      result[alias] ??= aliasPath;
    }
  }

  return result;
}

function getPathAliases(cwd: string): Record<string, string> {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    return getPathAliasesRecursive(tsconfigPath);
  }

  const jsconfigPath = path.join(cwd, "jsconfig.json");
  if (fs.existsSync(jsconfigPath)) {
    return getPathAliasesRecursive(jsconfigPath);
  }

  return {};
}

function loadDotEnv(cwd: string): void {
  dotenv.config({ path: path.join(cwd, ".env"), quiet: true });
  dotenv.config({ override: true, path: path.join(cwd, ".env.local"), quiet: true });
}

async function loadModule(cwd: string, configPath: string): Promise<unknown> {
  loadDotEnv(cwd);

  const jiti = createJiti(configPath, {
    alias: getPathAliases(cwd),
    interopDefault: false,
    jsx: true,
    moduleCache: false,
  });

  return jiti.import(configPath);
}

function getPayKit(moduleValue: unknown) {
  if (!moduleValue || typeof moduleValue !== "object") return null;

  const moduleObject = moduleValue as Record<string, unknown>;
  return (
    [moduleObject.paykit, moduleObject.default].find(
      (value): value is { options: PayKitOptions } =>
        isPayKitInstance(value) || isPayKitLike(value),
    ) ?? null
  );
}

function isPayKitLike(value: unknown): value is { options: PayKitOptions } {
  if (!value || typeof value !== "object") return false;

  const paykit = value as Record<string, unknown>;
  return (
    typeof paykit.handler === "function" &&
    typeof paykit.subscribe === "function" &&
    typeof paykit.handleWebhook === "function" &&
    "options" in paykit
  );
}

export async function getPayKitConfig({ cwd, configPath }: { cwd: string; configPath?: string }) {
  if (configPath) {
    const resolvedPath = path.isAbsolute(configPath) ? configPath : path.resolve(cwd, configPath);
    return loadConfiguredPayKit(cwd, resolvedPath);
  }

  for (const possiblePath of possiblePayKitConfigPaths) {
    const resolvedPath = path.join(cwd, possiblePath);
    if (!fs.existsSync(resolvedPath)) {
      continue;
    }

    return loadConfiguredPayKit(cwd, resolvedPath);
  }

  throw new Error(
    "No PayKit configuration file found. Add a `paykit.ts` file to your project or pass the path with `--config`.",
  );
}

async function loadConfiguredPayKit(cwd: string, resolvedPath: string) {
  const loadedModule = await loadModule(cwd, resolvedPath);
  const paykit = getPayKit(loadedModule);
  if (!paykit) {
    throw new Error(
      `Couldn't read your PayKit instance in ${resolvedPath}. Export your PayKit instance as \`paykit\` or default export the result of \`createPayKit(...)\`.`,
    );
  }

  return {
    path: resolvedPath,
    options: paykit.options,
  };
}
