export type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

export const packageManagers = [
  "pnpm",
  "npm",
  "bun",
  "yarn",
] as const satisfies readonly PackageManager[];

export const packageManagerStorageKey = "paykit-package-manager";
export const fallbackPackageManager: PackageManager = "pnpm";

export function isPackageManager(value: string | null): value is PackageManager {
  return packageManagers.includes(value as PackageManager);
}

export function parsePackageManager(value: string | null | undefined): PackageManager {
  const candidate = value ?? null;
  if (isPackageManager(candidate)) return candidate;
  return fallbackPackageManager;
}
