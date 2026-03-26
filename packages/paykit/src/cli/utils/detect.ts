import fs from "node:fs";
import path from "node:path";

export function detectPackageManager(cwd: string): "pnpm" | "npm" | "yarn" | "bun" {
  // 1. Check npm_config_user_agent (set by the running package manager)
  const userAgent = process.env.npm_config_user_agent ?? "";
  if (userAgent.startsWith("pnpm")) return "pnpm";
  if (userAgent.startsWith("yarn")) return "yarn";
  if (userAgent.startsWith("bun")) return "bun";

  // 2. Check lockfiles in cwd and parent dirs (monorepo support)
  let dir = cwd;
  while (true) {
    if (fs.existsSync(path.join(dir, "pnpm-lock.yaml"))) return "pnpm";
    if (fs.existsSync(path.join(dir, "yarn.lock"))) return "yarn";
    if (fs.existsSync(path.join(dir, "bun.lockb")) || fs.existsSync(path.join(dir, "bun.lock")))
      return "bun";
    if (fs.existsSync(path.join(dir, "package-lock.json"))) return "npm";
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return "npm";
}

export function isPackageInstalled(cwd: string, name: string): boolean {
  const pkgPath = path.join(cwd, "package.json");
  if (!fs.existsSync(pkgPath)) return false;

  try {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.[name] || pkg.devDependencies?.[name]);
  } catch {
    return false;
  }
}

export function hasTsconfigPathAlias(cwd: string): boolean {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (!fs.existsSync(tsconfigPath)) return false;

  try {
    const raw = fs.readFileSync(tsconfigPath, "utf-8");
    // Strip comments for JSON.parse
    const stripped = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig = JSON.parse(stripped) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    return Boolean(tsconfig.compilerOptions?.paths?.["@/*"]);
  } catch {
    return false;
  }
}

export function resolveImportPath(fromFile: string, toFile: string, cwd: string): string {
  if (hasTsconfigPathAlias(cwd)) {
    // Convert src/server/paykit.ts → @/server/paykit
    const srcRelative = path.relative(path.join(cwd, "src"), toFile);
    if (!srcRelative.startsWith("..")) {
      return "@/" + srcRelative.replace(/\.tsx?$/, "");
    }
  }

  // Compute relative path
  const fromDir = path.dirname(fromFile);
  let relative = path.relative(fromDir, toFile).replace(/\.tsx?$/, "");
  if (!relative.startsWith(".")) {
    relative = "./" + relative;
  }
  return relative;
}

export function defaultConfigPath(cwd: string): string {
  if (fs.existsSync(path.join(cwd, "src", "server"))) return "src/server/paykit.ts";
  if (fs.existsSync(path.join(cwd, "src", "lib"))) return "src/lib/paykit.ts";
  if (fs.existsSync(path.join(cwd, "src"))) return "src/paykit.ts";
  return "paykit.ts";
}

export function defaultRoutePath(cwd: string): string {
  if (fs.existsSync(path.join(cwd, "src", "app"))) {
    return "src/app/paykit/api/[...slug]/route.ts";
  }
  if (fs.existsSync(path.join(cwd, "app"))) {
    return "app/paykit/api/[...slug]/route.ts";
  }
  return "src/app/paykit/api/[...slug]/route.ts";
}
