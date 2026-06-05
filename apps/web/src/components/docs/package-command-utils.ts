import type { PackageManager } from "@/components/docs/package-manager-state";

type CommandKind = "install" | "dlx" | "create" | "run";

export interface PackageCommand {
  kind: CommandKind;
  args: string;
}

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
