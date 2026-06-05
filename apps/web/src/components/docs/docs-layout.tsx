"use client";

import { useHotkey } from "@tanstack/react-hotkeys";
import type { Root } from "fumadocs-core/page-tree";
import type * as PageTree from "fumadocs-core/page-tree";
import { useSearchContext } from "fumadocs-ui/contexts/search";
import { TreeContextProvider } from "fumadocs-ui/contexts/tree";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useState } from "react";
import { RiSearchLine, RiSideBarLine } from "react-icons/ri";

import { getDocsPageIcon } from "@/components/docs/docs-icons";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BrandMenu } from "@/components/web/brand-menu";
import { cn } from "@/lib/utils";

type DocsLayoutStyle = CSSProperties & {
  "--fd-layout-width": string;
  "--fd-sidebar-col": string;
};

function SearchButton({ className }: { className?: string }) {
  const { setOpenSearch } = useSearchContext();

  return (
    <button
      type="button"
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-8 items-center gap-2 rounded-sm border bg-secondary/50 px-2 text-sm transition-colors dark:hover:bg-muted/50",
        className,
      )}
      onClick={() => setOpenSearch(true)}
    >
      <RiSearchLine className="size-4 shrink-0" />
      <span>Search</span>
      <span className="ml-auto inline-flex items-center gap-0.5 font-mono text-[11px]">
        <kbd className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-sm border bg-background p-0">
          <span className="mt-[1.2px] text-[14px] leading-none">⌘</span>
        </kbd>
        <kbd className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-sm border bg-background p-0">
          <span className="mt-px">K</span>
        </kbd>
      </span>
    </button>
  );
}

function SidebarContent({
  onItemClick,
  pathname,
  tree,
}: {
  onItemClick?: () => void;
  pathname: string;
  tree: Root;
}) {
  const sections = getSidebarSections(tree.children);

  return (
    <nav className="no-scrollbar flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-2 text-sm">
      {sections.map((section, index) => {
        return (
          <div className="flex flex-col gap-1" key={section.key ?? index}>
            {section.separator ? <SidebarSeparator separator={section.separator} /> : null}
            <div className="flex flex-col gap-0.5">
              {section.children.map((node, childIndex) => (
                <SidebarNode
                  key={node.$id ?? `${node.type}-${childIndex}`}
                  node={node}
                  onItemClick={onItemClick}
                  pathname={pathname}
                />
              ))}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

function DocsSidebar({
  onCollapse,
  open,
  tree,
}: {
  onCollapse: () => void;
  open: boolean;
  tree: Root;
}) {
  const pathname = usePathname();

  return (
    <div className="hidden [grid-area:sidebar] md:layout:[--fd-sidebar-width:250px] md:block">
      <aside
        data-open={open}
        className={cn(
          "fixed inset-y-0 left-[max(0px,calc((100vw-var(--fd-layout-width))/2))] z-20 flex w-(--fd-sidebar-width) border-x bg-background",
          "transition-[opacity,translate] duration-200 ease-out",
          !open && "pointer-events-none -translate-x-2 opacity-0",
        )}
      >
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
            <SearchButton className="w-full" />
          </div>
          <SidebarContent pathname={pathname} tree={tree} />
        </div>
      </aside>
    </div>
  );
}

function SidebarIsland({
  onOpen,
  onSearch,
  visible,
}: {
  onOpen: () => void;
  onSearch: () => void;
  visible: boolean;
}) {
  return (
    <div
      className={cn(
        "fixed top-4 left-4 z-30 hidden rounded-md border bg-background p-0.5 md:flex",
        "transition-[opacity,scale,translate] duration-200 ease-out",
        visible
          ? "delay-150 opacity-100"
          : "pointer-events-none -translate-x-1 scale-95 opacity-0 delay-0",
      )}
    >
      <Button
        aria-label="Show sidebar"
        onClick={onOpen}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <RiSideBarLine />
      </Button>
      <Button
        aria-label="Open search"
        onClick={onSearch}
        size="icon-sm"
        type="button"
        variant="ghost"
      >
        <RiSearchLine />
      </Button>
    </div>
  );
}

function MobileSidebar({
  onOpenChange,
  open,
  tree,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  tree: Root;
}) {
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showCloseButton={false}
        className="w-[min(18rem,calc(100vw-2rem))] gap-0 border-r bg-background p-0 sm:max-w-none"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Documentation navigation</SheetTitle>
          <SheetDescription>Browse docs pages and sections.</SheetDescription>
        </SheetHeader>
        <div className="flex h-full flex-col">
          <div className="flex h-12 items-center border-b px-2.5">
            <BrandMenu
              linkClassName="rounded-sm px-2 py-1.5 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors"
              wordmarkBaseClassName="h-3.5"
            />
          </div>
          <SidebarContent onItemClick={() => onOpenChange(false)} pathname={pathname} tree={tree} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface SidebarSection {
  key?: string;
  separator?: PageTree.Separator;
  children: PageTree.Node[];
}

function getSidebarSections(nodes: PageTree.Node[]): SidebarSection[] {
  const sections: SidebarSection[] = [];
  let current: SidebarSection | undefined;

  for (const [index, node] of nodes.entries()) {
    const next = nodes[index + 1];

    if (node.type === "separator") {
      if (isDuplicateFolderSeparator(node, next)) {
        current = undefined;
        continue;
      }

      current = {
        key: node.$id,
        separator: node,
        children: [],
      };
      sections.push(current);
      continue;
    }

    if (!current) {
      current = {
        key: node.$id,
        children: [],
      };
      sections.push(current);
    }

    current.children.push(node);
  }

  return sections.filter((section) => section.separator || section.children.length > 0);
}

function isDuplicateFolderSeparator(
  separator: PageTree.Separator,
  next: PageTree.Node | undefined,
): boolean {
  return (
    next?.type === "folder" &&
    String(separator.name).toLowerCase() === String(next.name).toLowerCase()
  );
}

function SidebarSeparator({ separator }: { separator: PageTree.Separator }) {
  return (
    <div className="flex h-6 items-center px-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
      <span className="truncate">{separator.name}</span>
    </div>
  );
}

function SidebarNode({
  node,
  onItemClick,
  pathname,
}: {
  node: PageTree.Node;
  onItemClick?: () => void;
  pathname: string;
}) {
  if (node.type === "separator") {
    return <SidebarSeparator separator={node} />;
  }

  if (node.type === "folder") {
    return <SidebarFolder folder={node} onItemClick={onItemClick} pathname={pathname} />;
  }

  return <SidebarItem item={node} onItemClick={onItemClick} pathname={pathname} />;
}

function SidebarFolder({
  folder,
  onItemClick,
  pathname,
}: {
  folder: PageTree.Folder;
  onItemClick?: () => void;
  pathname: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-6 items-center px-2 text-[11px] font-medium tracking-wide text-muted-foreground/70 uppercase">
        <span className="truncate">{folder.name}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        {folder.index ? (
          <SidebarItem item={folder.index} onItemClick={onItemClick} pathname={pathname} />
        ) : null}
        {folder.children.map((node, index) => (
          <SidebarNode
            key={node.$id ?? `${node.type}-${index}`}
            node={node}
            onItemClick={onItemClick}
            pathname={pathname}
          />
        ))}
      </div>
    </div>
  );
}

function SidebarItem({
  item,
  onItemClick,
  pathname,
}: {
  item: PageTree.Item;
  onItemClick?: () => void;
  pathname: string;
}) {
  const active = pathname === item.url;

  return (
    <Link
      href={item.url}
      onClick={onItemClick}
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

export function DocsLayout({ children, tree }: { children: ReactNode; tree: Root }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [previousSidebarOpen, setPreviousSidebarOpen] = useState(sidebarOpen);
  const { setOpenSearch } = useSearchContext();
  const isColumnChanged = previousSidebarOpen !== sidebarOpen;

  useHotkey(
    "Mod+B",
    () => {
      setSidebarOpen((open) => !open);
    },
    {
      ignoreInputs: true,
      preventDefault: true,
    },
  );

  useEffect(() => {
    if (isColumnChanged) setPreviousSidebarOpen(sidebarOpen);
  }, [isColumnChanged, sidebarOpen]);

  const layoutStyle = {
    "--fd-layout-width": "90rem",
    "--fd-sidebar-col": sidebarOpen ? "var(--fd-sidebar-width)" : "0px",
    gridTemplateAreas: `
      "sidebar sidebar header toc toc"
      "sidebar sidebar toc-popover toc toc"
      "sidebar sidebar main toc toc"
    `,
    gridTemplateRows: "var(--fd-header-height) var(--fd-toc-popover-height) 1fr",
    gridTemplateColumns:
      "minmax(0, 1fr) var(--fd-sidebar-col) minmax(0, calc(var(--fd-layout-width) - var(--fd-sidebar-width) - var(--fd-toc-width))) var(--fd-toc-width) minmax(0, 1fr)",
  } satisfies DocsLayoutStyle;

  return (
    <TreeContextProvider tree={tree}>
      <div
        id="nd-docs-layout"
        data-column-changed={isColumnChanged}
        style={layoutStyle}
        className={cn(
          "grid min-h-(--fd-docs-height) overflow-x-clip",
          "[--fd-docs-height:100dvh] [--fd-docs-row-1:0px] [--fd-docs-row-2:var(--fd-header-height)] [--fd-docs-row-3:calc(var(--fd-docs-row-2)+var(--fd-toc-popover-height))]",
          "[--fd-header-height:0px] [--fd-sidebar-width:0px] [--fd-toc-popover-height:0px] [--fd-toc-width:0px]",
          "data-[column-changed=true]:transition-[grid-template-columns] data-[column-changed=true]:duration-200 data-[column-changed=true]:ease-out",
          "max-md:[--fd-header-height:3rem]",
        )}
      >
        <DocsSidebar onCollapse={() => setSidebarOpen(false)} open={sidebarOpen} tree={tree} />
        <SidebarIsland
          onOpen={() => setSidebarOpen(true)}
          onSearch={() => setOpenSearch(true)}
          visible={!sidebarOpen}
        />
        <MobileSidebar open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen} tree={tree} />
        <header
          id="nd-subnav"
          data-transparent="false"
          className="fixed top-0 z-30 flex h-12 w-full flex-row items-center justify-between border-b bg-background px-2.5 [grid-area:header] md:hidden"
        >
          <BrandMenu
            className="md:hidden"
            linkClassName="rounded-sm px-2 py-1.5 hover:bg-muted hover:text-foreground dark:hover:bg-muted/50 transition-colors"
            wordmarkBaseClassName="h-3.5"
          />
          <div className="flex items-center gap-1 md:hidden">
            <Button
              aria-label="Open search"
              className="size-8 text-muted-foreground"
              onClick={() => setOpenSearch(true)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <RiSearchLine className="size-4" />
            </Button>
            <Button
              aria-label="Open sidebar"
              className="size-8 text-muted-foreground"
              onClick={() => setMobileSidebarOpen(true)}
              size="icon-sm"
              type="button"
              variant="ghost"
            >
              <RiSideBarLine className="size-4" />
            </Button>
          </div>
        </header>
        {children}
      </div>
    </TreeContextProvider>
  );
}
