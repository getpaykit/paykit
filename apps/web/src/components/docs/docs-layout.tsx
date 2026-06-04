"use client";

import type { Root } from "fumadocs-core/page-tree";
import type * as PageTree from "fumadocs-core/page-tree";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { TreeContextProvider } from "fumadocs-ui/contexts/tree";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";
import { useState } from "react";
import { RiSearchLine, RiSideBarLine } from "react-icons/ri";

import { getDocsPageIcon } from "@/components/docs/docs-icons";
import { Button } from "@/components/ui/button";
import { BrandMenu } from "@/components/web/brand-menu";
import { cn } from "@/lib/utils";

type DocsLayoutStyle = CSSProperties & {
  "--fd-header-height": string;
  "--fd-layout-width": string;
};

function DocsSidebar({ onCollapse, tree }: { onCollapse: () => void; tree: Root }) {
  const { setOpenSearch } = useSearchContext();
  const pathname = usePathname();

  return (
    <div className="hidden [grid-area:sidebar] md:block">
      <aside className="fixed inset-y-0 left-[max(0px,calc((100vw-var(--fd-layout-width))/2))] z-20 flex w-(--fd-sidebar-width) border-x bg-background">
        <div className="flex h-full w-full flex-col">
          <div className="flex h-12 items-center justify-between px-2.5">
            <BrandMenu
              linkClassName="rounded-sm px-2 py-1.5 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors"
              wordmarkBaseClassName="h-3.5"
            />
            <Button
              aria-label="Hide sidebar"
              className="size-7 text-muted-foreground"
              onClick={onCollapse}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <RiSideBarLine />
            </Button>
          </div>
          <div className="px-2.5 pb-2">
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 w-full items-center gap-2 rounded-sm border bg-secondary/50 px-2 text-sm transition-colors dark:hover:bg-muted/50"
              onClick={() => setOpenSearch(true)}
            >
              <RiSearchLine className="size-4 shrink-0" />
              <span>Search</span>
              <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-[11px]">
                <kbd className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-sm border bg-background p-0">
                  <span className="text-[14px] leading-none mt-[1.2px]">⌘</span>
                </kbd>
                <kbd className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-sm border bg-background p-0">
                  <span className="mt-px">K</span>
                </kbd>
              </span>
            </button>
          </div>
          <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-2 text-sm">
            {tree.children.map((node, index) => {
              if (isDuplicateSeparator(node, tree.children[index + 1])) return null;

              return (
                <SidebarNode
                  key={node.$id ?? `${node.type}-${index}`}
                  node={node}
                  pathname={pathname}
                />
              );
            })}
          </nav>
        </div>
      </aside>
    </div>
  );
}

function isDuplicateSeparator(current: PageTree.Node, next: PageTree.Node | undefined): boolean {
  return (
    current.type === "separator" &&
    next?.type === "folder" &&
    String(current.name).toLowerCase() === String(next.name).toLowerCase()
  );
}

function SidebarNode({ node, pathname }: { node: PageTree.Node; pathname: string }) {
  if (node.type === "separator") {
    return (
      <div className="px-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        {node.name}
      </div>
    );
  }

  if (node.type === "folder") {
    return <SidebarFolder folder={node} pathname={pathname} />;
  }

  return <SidebarItem item={node} pathname={pathname} />;
}

function SidebarFolder({ folder, pathname }: { folder: PageTree.Folder; pathname: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-6 items-center px-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        <span className="truncate">{folder.name}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {folder.index ? <SidebarItem item={folder.index} pathname={pathname} /> : null}
        {folder.children.map((node, index) => (
          <SidebarNode key={node.$id ?? `${node.type}-${index}`} node={node} pathname={pathname} />
        ))}
      </div>
    </div>
  );
}

function SidebarItem({ item, pathname }: { item: PageTree.Item; pathname: string }) {
  const active = pathname === item.url;

  return (
    <Link
      href={item.url}
      className={cn(
        "flex h-7 items-center gap-2 rounded-sm px-2 text-[13px] transition-none",
        active
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/50",
      )}
    >
      {getDocsPageIcon(String(item.name))}
      <span className="truncate">{item.name}</span>
    </Link>
  );
}

export function DocsLayout({
  children,
  navTitle,
  tree,
}: {
  children: ReactNode;
  navTitle: ReactNode;
  tree: Root;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const layoutStyle = {
    "--fd-header-height": "35px",
    "--fd-layout-width": "92rem",
    gridTemplate: `
      "sidebar sidebar header toc toc" var(--fd-header-height)
      "sidebar sidebar toc-popover toc toc" var(--fd-toc-popover-height)
      "sidebar sidebar main toc toc" 1fr
      / minmax(0, 1fr) var(--fd-sidebar-width) minmax(0, calc(var(--fd-layout-width) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(0, 1fr)
    `,
  } satisfies DocsLayoutStyle;

  return (
    <TreeContextProvider tree={tree}>
      <div
        id="nd-docs-layout"
        data-column-changed="false"
        style={layoutStyle}
        className={cn(
          "grid min-h-(--fd-docs-height) overflow-x-clip",
          "[--fd-docs-height:100dvh] [--fd-docs-row-1:0px] [--fd-docs-row-2:var(--fd-header-height)] [--fd-docs-row-3:calc(var(--fd-docs-row-2)+var(--fd-toc-popover-height))]",
          "[--fd-sidebar-width:0px] [--fd-toc-popover-height:0px] [--fd-toc-width:0px]",
          sidebarOpen && "md:[--fd-sidebar-width:250px]",
          "xl:[--fd-toc-width:250px] max-md:[--fd-header-height:--spacing(14)]",
        )}
      >
        {sidebarOpen && <DocsSidebar onCollapse={() => setSidebarOpen(false)} tree={tree} />}
        <header
          id="nd-subnav"
          data-transparent="false"
          className="pointer-events-none fixed top-0 z-50 flex h-14 w-full flex-row items-center justify-between border-b bg-fd-background p-0 [grid-area:header] md:sticky md:h-[35px] md:border-b-0 md:bg-transparent"
        >
          <a
            className="pointer-events-auto inline-flex items-center gap-2.5 ps-4 font-semibold md:hidden"
            href="/"
          >
            {navTitle}
          </a>
        </header>
        {children}
      </div>
    </TreeContextProvider>
  );
}
