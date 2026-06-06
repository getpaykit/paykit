import type { PackageManager } from "@/components/docs/package-manager-state";

type CommandKind = "install" | "dlx" | "create" | "run";

/** Parsed package-manager command metadata. */
export interface PackageCommand {
  /** Command category parsed from a shell snippet. */
  kind: CommandKind;
  /** Arguments after the package-manager command prefix. */
  args: string;
}

/**
 * Formats a parsed command for the selected package manager.
 *
 * @param command - Parsed package command.
 * @param manager - Target package manager.
 * @returns Shell command for npm, yarn, bun, or pnpm. `dlx` defaults to pnpm.
 */
export function commandForManager(command: PackageCommand, manager: PackageManager): string {
  switch (command.kind) {
    case "install":
      return manager === "npm" ? `npm install ${command.args}` : `${manager} add ${command.args}`;
    case "dlx":
      if (manager === "npm") return `npx ${command.args}`;
      if (manager === "yarn") return `yarn dlx ${command.args}`;
      if (manager === "bun") return `bunx --bun ${command.args}`;
      return `pnpm dlx ${command.args}`;
    case "create":
      return `${manager} create ${command.args}`;
    case "run":
      return manager === "npm" ? `npm run ${command.args}` : `${manager} ${command.args}`;
  }
}
