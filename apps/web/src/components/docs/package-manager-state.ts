export type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

export const packageManagers = [
  "npm",
  "yarn",
  "bun",
  "pnpm",
] as const satisfies readonly PackageManager[];
export const packageManagerCookieName = "paykit-package-manager";
export const fallbackPackageManager: PackageManager = "npm";

export function isPackageManager(value: string | null): value is PackageManager {
  return packageManagers.includes(value as PackageManager);
}

export function parsePackageManagerCookie(value: string | undefined): PackageManager {
  const candidate = value ?? null;
  if (isPackageManager(candidate)) return candidate;
  return fallbackPackageManager;
}
