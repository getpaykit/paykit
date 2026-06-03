"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import type { ComponentProps, ReactNode, SVGProps } from "react";
import { createContext, isValidElement, useCallback, useContext, useEffect, useState } from "react";
import { RiCheckLine, RiFileCopyLine } from "react-icons/ri";

import {
  fallbackPackageManager,
  isPackageManager,
  packageManagerCookieName,
  packageManagers,
  type PackageManager,
} from "@/components/docs/package-manager-state";
import { buttonVariants } from "@/components/ui/button";
import { useCopyButton } from "@/components/ui/use-copy-button";
import { cn } from "@/lib/utils";

type CommandKind = "install" | "dlx" | "create" | "run";
type TabsVariant = "default" | "underline";

export interface PackageCommand {
  kind: CommandKind;
  args: string;
}

const packageManagerEventName = "paykit-package-manager";
const PackageManagerContext = createContext<PackageManager>(fallbackPackageManager);

function setStoredManager(value: PackageManager) {
  document.cookie = `${packageManagerCookieName}=${value}; path=/; max-age=31536000; samesite=lax`;
  window.dispatchEvent(new CustomEvent(packageManagerEventName, { detail: value }));
}

function usePackageManager() {
  const initialManager = useContext(PackageManagerContext);
  const [manager, setManagerState] = useState<PackageManager>(initialManager);

  useEffect(() => {
    function handleLocal(event: Event) {
      const value = (event as CustomEvent<PackageManager>).detail;
      if (isPackageManager(value)) setManagerState(value);
    }

    window.addEventListener(packageManagerEventName, handleLocal);

    return () => {
      window.removeEventListener(packageManagerEventName, handleLocal);
    };
  }, []);

  const setManager = useCallback((value: PackageManager) => {
    setManagerState(value);
    setStoredManager(value);
  }, []);

  return [manager, setManager] as const;
}

export function PackageManagerProvider({
  initialManager,
  children,
}: {
  initialManager: PackageManager;
  children: ReactNode;
}) {
  return (
    <PackageManagerContext.Provider value={initialManager}>
      {children}
    </PackageManagerContext.Provider>
  );
}

function Tabs({ className, ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)}
      data-slot="tabs"
      {...props}
    />
  );
}

function TabsList({
  variant = "default",
  indicatorClassName,
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  variant?: TabsVariant;
  indicatorClassName?: string;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        "text-muted-foreground relative z-0 flex w-fit items-center justify-center gap-x-0.5",
        "data-[orientation=vertical]:flex-col",
        variant === "default"
          ? "bg-muted text-muted-foreground/72 rounded-lg p-0.5"
          : "*:data-[slot=tabs-trigger]:hover:bg-accent/50 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1",
        className,
      )}
      data-slot="tabs-list"
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          "absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out",
          variant === "underline"
            ? "bg-primary! z-10 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:translate-y-px data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px"
            : "bg-background dark:bg-accent -z-1 rounded-md shadow-sm",
          indicatorClassName,
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

function TabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "focus-visible:ring-ring select-none flex shrink-0 grow cursor-pointer items-center justify-center rounded-md text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-2 data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
        "hover:text-primary data-active:text-foreground",
        "h-6 gap-1.5 px-[calc(--spacing(2.5)-1px)]",
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

function TabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn("flex-1 outline-none", className)}
      data-slot="tabs-content"
      {...props}
    />
  );
}

function extractText(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return extractText(node.props.children);
  return "";
}

function commandForManager(command: PackageCommand, manager: PackageManager): string {
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

function CommandText({ command }: { command: string }) {
  return <span className="whitespace-pre">{command}</span>;
}

function cleanCopyText(value: string): string {
  return value
    .replace(/\s*\/\/\s*\[!code\s+[^\]]+\]\s*$/gm, "")
    .replace(/\s*\{?\s*\/\*\s*\[!code\s+[^\]]+\]\s*\*\/\s*\}?\s*$/gm, "")
    .replace(/\s*<!--\s*\[!code\s+[^\]]+\]\s*-->\s*$/gm, "")
    .replace(/\n+$/, "");
}

function CopyButton({ className, code }: { className?: string; code: string }) {
  const [checked, onClick] = useCopyButton(() => navigator.clipboard.writeText(code));

  return (
    <button
      type="button"
      className={cn(
        buttonVariants({ variant: "ghost", size: "icon" }),
        "relative h-6 w-6 rounded border-none text-foreground/45 active:scale-90 dark:hover:bg-[#232323]!",
        className,
      )}
      aria-label="Copy command"
      onClick={onClick}
    >
      <RiCheckLine className={cn("size-3.5 transition-transform", !checked && "scale-0")} />
      <RiFileCopyLine
        className={cn("absolute size-3.5 transition-transform", checked && "scale-0")}
      />
    </button>
  );
}

export function PackageManagerCommandBlock({ command }: { command: PackageCommand }) {
  const [manager, setManager] = usePackageManager();
  const activeCommand = commandForManager(command, manager);

  return (
    <Tabs
      defaultValue="npm"
      value={manager}
      onValueChange={(value) => {
        if (isPackageManager(value)) setManager(value);
      }}
    >
      <div className="dark:bg-primary-foreground group mt-2 flex flex-col rounded-none bg-[#F5F5F5] px-1 pb-1 pt-0.5">
        <div className="flex flex-row items-center justify-between pr-1 pl-2">
          <TabsList variant="underline">
            <TabsTab
              className="h-5! gap-2 px-1.5 hover:bg-transparent! hover:text-foreground data-active:text-foreground data-active:hover:text-foreground"
              value="npm"
            >
              <NpmIcon className="size-3" />
              npm
            </TabsTab>
            <TabsTab
              className="h-5! gap-2 px-1.5 hover:bg-transparent! hover:text-foreground data-active:text-foreground data-active:hover:text-foreground"
              value="yarn"
            >
              <YarnIcon className="size-[0.7875rem]" />
              yarn
            </TabsTab>
            <TabsTab
              className="h-5! gap-2 px-1.5 hover:bg-transparent! hover:text-foreground data-active:text-foreground data-active:hover:text-foreground"
              value="bun"
            >
              <BunIcon className="size-[0.7875rem]" />
              bun
            </TabsTab>
            <TabsTab
              className="h-5! gap-2 px-1.5 hover:bg-transparent! hover:text-foreground data-active:text-foreground data-active:hover:text-foreground"
              value="pnpm"
            >
              <PnpmIcon className="size-3" />
              pnpm
            </TabsTab>
          </TabsList>
          <CopyButton code={activeCommand} />
        </div>
        <div className="bg-background text-muted-foreground rounded-none border p-3 text-[13px] leading-normal">
          {packageManagers.map((item) => (
            <TabsPanel className="font-mono" key={item} value={item}>
              <CommandText command={commandForManager(command, item)} />
            </TabsPanel>
          ))}
        </div>
      </div>
    </Tabs>
  );
}

export function DefaultPre({
  children,
  className,
  title,
  icon,
  ...props
}: ComponentProps<"pre"> & { icon?: ReactNode }) {
  const code = cleanCopyText(extractText(children));
  const hasTitle = title !== undefined;

  return (
    <div
      className={cn(
        "not-fumadocs-codeblock dark:bg-primary-foreground group relative mt-4 bg-[#F5F5F5]",
        hasTitle ? "px-1 pb-1 pt-0.5" : "p-1",
      )}
    >
      {hasTitle ? (
        <div className="flex flex-row items-center justify-between pr-1 pl-2 text-xs font-medium text-muted-foreground">
          <div className="flex min-w-0 items-center gap-2">
            {typeof icon === "string" ? (
              <div className="[&_svg]:size-3" dangerouslySetInnerHTML={{ __html: icon }} />
            ) : (
              icon
            )}
            <div className="min-w-0 flex-1 truncate">{title}</div>
          </div>
          <CopyButton code={code} />
        </div>
      ) : null}
      {!hasTitle ? (
        <CopyButton
          className="absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:opacity-100"
          code={code}
        />
      ) : null}
      <pre
        {...props}
        className={cn(
          className,
          "bg-background w-max min-w-full overflow-x-auto rounded-none! border px-0 py-3 text-[13px] leading-normal outline-none has-data-highlighted-line:px-0 has-data-line-numbers:px-0 has-data-[slot=tabs]:p-0 [&>code]:flex [&>code]:flex-col [&>code]:px-0! [&_.line]:px-3",
          !hasTitle && "[&_.line]:pr-10",
        )}
      >
        {children}
      </pre>
    </div>
  );
}

function NpmIcon({
  fill = "currentColor",
  width = "1em",
  height = "1em",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      height={height}
      width={width}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="m7.415 7.656 17.291.024-.011 17.29h-4.329l.012-12.974h-4.319l-.01 12.964H7.393zM3.207 1.004h-.005a2.2 2.2 0 0 0-2.198 2.198v25.596c0 1.214.984 2.198 2.198 2.198h25.596a2.2 2.2 0 0 0 2.198-2.198V3.202a2.2 2.2 0 0 0-2.198-2.198h-.006z"
        fill={fill}
      />
    </svg>
  );
}

function YarnIcon({
  fill = "currentColor",
  width = "1em",
  height = "1em",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      height={height}
      width={width}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M28.208 24.409a10.5 10.5 0 0 0-3.959 1.822 23.7 23.7 0 0 1-5.835 2.642 1.63 1.63 0 0 1-.983.55 62 62 0 0 1-6.447.577c-1.163.009-1.876-.3-2.074-.776a1.573 1.573 0 0 1 .866-2.074 4 4 0 0 1-.514-.379c-.171-.171-.352-.514-.406-.388-.225.55-.343 1.894-.947 2.5-.83.839-2.4.559-3.328.072-1.019-.541.072-1.813.072-1.813a.73.73 0 0 1-.992-.343 4.85 4.85 0 0 1-.667-2.949 5.37 5.37 0 0 1 1.749-2.895 9.3 9.3 0 0 1 .658-4.4 10.45 10.45 0 0 1 3.165-3.661S6.628 10.747 7.35 8.817c.469-1.262.658-1.253.812-1.308a3.6 3.6 0 0 0 1.452-.857 5.27 5.27 0 0 1 4.41-1.7S15.2 1.4 16.277 2.09a18.4 18.4 0 0 1 1.533 2.886s1.281-.748 1.425-.469a11.33 11.33 0 0 1 .523 6.132 14 14 0 0 1-2.6 5.411c-.135.225 1.551.938 2.615 3.887.983 2.7.108 4.96.262 5.212.027.045.036.063.036.063s1.127.09 3.391-1.308a8.5 8.5 0 0 1 4.277-1.604 1.081 1.081 0 0 1 .469 2.11Z"
        fill={fill}
      />
    </svg>
  );
}

function BunIcon({
  fill = "currentColor",
  width = "1em",
  height = "1em",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 32 32"
      {...props}
    >
      <path
        fill={fill}
        d="M29 17c0 5.65-5.82 10.23-13 10.23S3 22.61 3 17c0-3.5 2.24-6.6 5.66-8.44S14.21 4.81 16 4.81s3.32 1.54 7.34 3.71C26.76 10.36 29 13.46 29 17"
      />
      <path
        fill="none"
        stroke={fill}
        d="M16 27.65c7.32 0 13.46-4.65 13.46-10.65 0-3.72-2.37-7-5.89-8.85-1.39-.75-2.46-1.41-3.37-2l-1.13-.69A6.14 6.14 0 0 0 16 4.35a6.9 6.9 0 0 0-3.3 1.23c-.42.24-.86.51-1.32.8-.87.54-1.83 1.13-3 1.73C4.91 10 2.54 13.24 2.54 17c0 6 6.14 10.65 13.46 10.65Z"
      />
      <ellipse cx="21.65" cy="18.62" fill={fill} rx="2.17" ry="1.28" />
      <ellipse cx="10.41" cy="18.62" fill={fill} rx="2.17" ry="1.28" />
      <path
        fillRule="evenodd"
        d="M11.43 18.11a2 2 0 1 0-2-2.05 2.05 2.05 0 0 0 2 2.05m9.2 0a2 2 0 1 0-2-2.05 2 2 0 0 0 2 2.05"
      />
      <path
        fill={fill}
        fillRule="evenodd"
        d="M10.79 16.19a.77.77 0 1 0-.76-.77.76.76 0 0 0 .76.77m9.2 0a.77.77 0 1 0 0-1.53.77.77 0 0 0 0 1.53"
      />
      <path
        fill={fill}
        stroke={fill}
        strokeWidth=".75"
        d="M18.62 19.67a3.3 3.3 0 0 1-1.09 1.75 2.48 2.48 0 0 1-1.5.69 2.53 2.53 0 0 1-1.5-.69 3.28 3.28 0 0 1-1.08-1.75.26.26 0 0 1 .29-.3h4.58a.27.27 0 0 1 .3.3Z"
      />
      <path
        fill={fill}
        fillRule="evenodd"
        d="M14.93 5.75a6.1 6.1 0 0 1-2.09 4.62c-.1.09 0 .27.11.22 1.25-.49 2.94-1.94 2.23-4.88-.03-.15-.25-.11-.25.04m.85 0a6 6 0 0 1 .57 5c0 .13.12.24.21.13.83-1 1.54-3.11-.59-5.31-.1-.11-.27.04-.19.17Zm1-.06a6.1 6.1 0 0 1 2.53 4.38c0 .14.21.17.24 0 .34-1.3.15-3.51-2.66-4.66-.12-.02-.21.18-.09.27ZM9.94 9.55a6.27 6.27 0 0 0 3.89-3.33c.07-.13.28-.08.25.07-.64 3-2.79 3.59-4.13 3.51-.14-.01-.14-.21-.01-.25"
      />
    </svg>
  );
}

function PnpmIcon({
  fill = "currentColor",
  width = "1em",
  height = "1em",
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="0 0 32 32"
      {...props}
    >
      <path
        d="M30 10.75h-8.749V2H30Zm-9.626 0h-8.75V2h8.75Zm-9.625 0H2V2h8.749ZM30 20.375h-8.749v-8.75H30Z"
        fill={fill}
      />
      <path
        d="M20.374 20.375h-8.75v-8.75h8.75Zm0 9.625h-8.75v-8.75h8.75ZM30 30h-8.749v-8.75H30Zm-19.251 0H2v-8.75h8.749Z"
        fill={fill}
        opacity="0.4"
      />
    </svg>
  );
}
