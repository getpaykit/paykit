import type { ComponentProps, ReactNode } from "react";
import { isValidElement } from "react";

import {
  DefaultPre,
  PackageManagerCommandBlock,
  type PackageCommand,
} from "@/components/docs/package-command";

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children);
  return "";
}

function normalizeCommand(value: string): string {
  return value.replace(/\n+$/, "").trim();
}

function hasSingleLine(value: string): boolean {
  return value.split("\n").filter((line) => line.trim().length > 0).length === 1;
}

function isShellLanguage(language: unknown): boolean {
  if (typeof language !== "string") return false;
  return ["bash", "sh", "shell", "zsh"].includes(language);
}

function parsePackageCommand(command: string): PackageCommand | null {
  const trimmed = normalizeCommand(command);

  for (const prefix of ["npm install ", "npm i "]) {
    if (trimmed.startsWith(prefix)) return { kind: "install", args: trimmed.slice(prefix.length) };
  }

  if (trimmed.startsWith("npx ")) return { kind: "dlx", args: trimmed.slice("npx ".length) };
  if (trimmed.startsWith("npm create ")) {
    return { kind: "create", args: trimmed.slice("npm create ".length) };
  }
  if (trimmed.startsWith("npm run ")) {
    return { kind: "run", args: trimmed.slice("npm run ".length) };
  }

  return null;
}

export function PackageCommandPre(props: ComponentProps<"pre"> & { "data-language"?: string }) {
  const commandText = normalizeCommand(extractText(props.children));
  const command = hasSingleLine(commandText) ? parsePackageCommand(commandText) : null;

  if (command && isShellLanguage(props["data-language"])) {
    return <PackageManagerCommandBlock command={command} />;
  }

  return <DefaultPre {...props} />;
}
