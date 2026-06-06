/** Supported package manager identifiers. */
export type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

/** Ordered package managers displayed by command switchers. */
export const packageManagers = [
  "pnpm",
  "npm",
  "bun",
  "yarn",
] as const satisfies readonly PackageManager[];

/** Storage key for the selected package manager preference. */
export const packageManagerStorageKey = "paykit-package-manager";

/** Default package manager used when no valid preference exists. */
export const fallbackPackageManager: PackageManager = "pnpm";

/**
 * Checks whether a value is a supported package manager.
 *
 * @param value - Candidate package manager string.
 * @returns Whether `value` is a PackageManager.
 */
export function isPackageManager(value: string | null): value is PackageManager {
  return packageManagers.includes(value as PackageManager);
}

/**
 * Parses a package manager value, falling back to pnpm when invalid.
 *
 * @param value - Candidate package manager string.
 * @returns A supported package manager.
 */
export function parsePackageManager(value: string | null | undefined): PackageManager {
  const candidate = value ?? null;
  if (isPackageManager(candidate)) return candidate;
  return fallbackPackageManager;
}
