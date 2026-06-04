"use client";

import type { Root } from "fumadocs-core/page-tree";
import { TreeContextProvider } from "fumadocs-ui/contexts/tree";
import type { CSSProperties } from "react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type DocsLayoutStyle = CSSProperties & {
  "--fd-header-height": string;
};

export function DocsLayout({
  children,
  navTitle,
  tree,
}: {
  children: ReactNode;
  navTitle: ReactNode;
  tree: Root;
}) {
  const layoutStyle = {
    "--fd-header-height": "35px",
    gridTemplate: `
      ". header header ." var(--fd-header-height)
      ". toc-popover toc-popover ." var(--fd-toc-popover-height)
      ". main toc ." 1fr
      / minmax(0, 1fr) minmax(0, 42rem) var(--fd-toc-width) minmax(0, 1fr)
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
          "[--fd-toc-popover-height:0px] [--fd-toc-width:0px]",
          "xl:layout:[--fd-toc-width:268px] max-md:layout:[--fd-header-height:--spacing(14)]",
        )}
      >
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
