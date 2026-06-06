import { spawn } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parse as parseDotenv } from "dotenv";

export const sandboxConfig = {
  appUrl: "https://sandbox.paykit.sh",
  envFile: ".env.sandbox.local",
  orgId: "team_aTDm0BA9FeXnYnflix3JVLeS",
  projectId: "prj_yE0iPxCyx5cKn9mXTE93tbTHbf0O",
  projectName: "pk-sandbox",
  target: "production",
} as const;

export const paykitPackages = ["paykitjs"] as const;

const scriptsDir = fileURLToPath(new URL(".", import.meta.url));

export const demoDir = path.resolve(scriptsDir, "..");
const repoRootDir = path.resolve(demoDir, "../..");

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/** Parse `--version <value>` from CLI args. */
export function parseVersionFlag(argv: string[]) {
  const helpRequested = argv.includes("--help") || argv.includes("-h");

  if (helpRequested) {
    return { helpRequested: true as const, version: null };
  }

  const flagIndex = argv.indexOf("--version");

  if (flagIndex === -1) {
    throw new Error("Missing required flag: --version <npm-spec>");
  }

  const version = argv[flagIndex + 1];

  if (!version || version.startsWith("-")) {
    throw new Error("Missing value for --version <npm-spec>");
  }

  return { helpRequested: false as const, version };
}

/** Run command with inherited stdio. */
export async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  envOverrides?: Record<string, string | undefined>,
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...envOverrides },
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      if (signal) {
        reject(new Error(`${command} exited with signal ${signal}`));
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

/** Ensure file exists before reading. */
export async function requireFile(filePath: string) {
  try {
    await stat(filePath);
  } catch {
    throw new Error(`Required file missing: ${filePath}`);
  }
}

/** Load sandbox env file with dotenv parsing. */
export async function loadSandboxEnvFile() {
  const filePath = path.join(demoDir, sandboxConfig.envFile);
  await requireFile(filePath);

  const raw = await readFile(filePath);
  const values = parseDotenv(raw);

  if (Object.keys(values).length === 0) {
    throw new Error(`${sandboxConfig.envFile} has no variables to push`);
  }

  return { filePath, values };
}

/** Create temp dir already linked to sandbox Vercel project. */
export async function createSandboxProjectDir(prefix: string) {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  await writeVercelProjectLink(dir);
  return dir;
}

/** Remove temp dir best-effort. */
export async function cleanupDir(dir: string) {
  await rm(dir, { force: true, recursive: true });
}

/** Build standalone demo app copy for sandbox deploy. */
export async function createStandaloneDemoCopy(version: string) {
  const tempDir = await createSandboxProjectDir("paykit-demo-sandbox-");

  await cp(demoDir, tempDir, {
    recursive: true,
    filter(source) {
      const name = path.basename(source);

      if ([".git", ".next", ".turbo", ".vercel", "node_modules"].includes(name)) {
        return false;
      }

      if (name.startsWith(".env")) {
        return false;
      }

      return true;
    },
  });

  await cp(path.join(repoRootDir, "tsconfig.base.json"), path.join(tempDir, "tsconfig.base.json"));

  await rewritePackageVersions(path.join(tempDir, "package.json"), version);
  await rewriteTempTsconfig(path.join(tempDir, "tsconfig.json"));
  await rewriteTempNextConfig(path.join(tempDir, "next.config.js"));
  await writeTempVercelConfig(path.join(tempDir, "vercel.json"));

  return tempDir;
}

async function writeVercelProjectLink(dir: string) {
  const vercelDir = path.join(dir, ".vercel");
  await mkdir(vercelDir, { recursive: true });
  await writeFile(
    path.join(vercelDir, "project.json"),
    `${JSON.stringify({ orgId: sandboxConfig.orgId, projectId: sandboxConfig.projectId }, null, 2)}\n`,
  );
}

async function rewritePackageVersions(packageJsonPath: string, version: string) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as PackageJson;

  for (const field of [
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
  ] as const) {
    const section = packageJson[field];

    if (!section) {
      continue;
    }

    for (const packageName of paykitPackages) {
      if (section[packageName]) {
        section[packageName] = version;
      }
    }
  }

  await writeFile(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

async function rewriteTempTsconfig(tsconfigPath: string) {
  const tsconfig = JSON.parse(await readFile(tsconfigPath, "utf8")) as Record<string, unknown>;
  tsconfig.extends = "./tsconfig.base.json";
  await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);
}

async function rewriteTempNextConfig(nextConfigPath: string) {
  const nextConfig = await readFile(nextConfigPath, "utf8");
  const updated = nextConfig.replace(
    'new URL("../..", import.meta.url)',
    'new URL(".", import.meta.url)',
  );
  await writeFile(nextConfigPath, updated);
}

async function writeTempVercelConfig(vercelConfigPath: string) {
  const vercelConfig = {
    buildCommand: "bun run build",
    framework: "nextjs",
    installCommand: "bun install",
  };

  await writeFile(vercelConfigPath, `${JSON.stringify(vercelConfig, null, 2)}\n`);
}
