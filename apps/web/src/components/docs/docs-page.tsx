"use client";

import { getBreadcrumbItemsFromPath, type BreadcrumbOptions } from "fumadocs-core/breadcrumb";
import { usePathname } from "fumadocs-core/framework";
import Link from "fumadocs-core/link";
import type * as PageTree from "fumadocs-core/page-tree";
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import { TOC, TOCProvider, type TOCProviderProps } from "fumadocs-ui/layouts/docs/page/slots/toc";
import type { ComponentProps, ReactNode } from "react";
import { Fragment, useMemo } from "react";
import { RiArrowLeftSLine, RiArrowRightSLine } from "react-icons/ri";

import { cn } from "@/lib/utils";

const tocWidthClassName = "xl:layout:[--fd-toc-width:250px]";

export function DocsPage({
  children,
  className,
  breadcrumb,
  footer = true,
  full = false,
  toc = [],
  tocFooter,
}: ComponentProps<"article"> & {
  breadcrumb?: BreadcrumbOptions & { enabled?: boolean };
  footer?: boolean;
  full?: boolean;
  toc?: TOCProviderProps["toc"];
  tocFooter?: ReactNode;
}) {
  const hasToc = toc.length > 0 || tocFooter !== undefined;

  return (
    <TOCProvider toc={toc}>
      {hasToc && <DocsTocLayoutMarker />}
      <article
        id="nd-page"
        data-full={full}
        className={cn(
          "flex w-full max-w-[43rem] flex-col px-4 pt-7 pb-32 md:pt-14",
          "mx-auto [grid-area:main]",
          full && "max-w-[1168px]",
          className,
        )}
      >
        {breadcrumb?.enabled !== false && <DocsBreadcrumb {...breadcrumb} />}
        {children}
        {footer && <DocsFooter />}
      </article>
      {hasToc && <DocsToc footer={tocFooter} />}
    </TOCProvider>
  );
}

export function DocsTitle({ children, className, ...props }: ComponentProps<"h1">) {
  return (
    <h1
      {...props}
      className={cn(
        "scroll-m-20 text-3xl font-semibold tracking-tight xl:text-[2.0625rem] xl:leading-[2.375rem]",
        className,
      )}
    >
      {children}
    </h1>
  );
}

export function DocsDescription({ children, className, ...props }: ComponentProps<"p">) {
  if (children === undefined) return null;

  return (
    <p {...props} className={cn("text-primary/80 mt-2 text-[15px]", className)}>
      {children}
    </p>
  );
}

export function DocsBody({ children, className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className={cn("docs-body text-primary/80 mt-8 w-full flex-1 text-[14px]", className)}
    >
      {children}
    </div>
  );
}

function DocsToc({ footer }: { footer?: ReactNode }) {
  return <TOC container={{ className: cn("pt-14", tocWidthClassName) }} footer={footer} />;
}

function DocsTocLayoutMarker() {
  return <div aria-hidden className={cn("hidden", tocWidthClassName)} />;
}

function DocsBreadcrumb({
  includePage,
  includeRoot,
  includeSeparator,
  className,
  ...props
}: BreadcrumbOptions & ComponentProps<"div">) {
  const path = useTreePath();
  const { root } = useTreeContext();
  const items = useMemo(
    () =>
      getBreadcrumbItemsFromPath(root, path, {
        includePage,
        includeRoot,
        includeSeparator,
      }),
    [includePage, includeRoot, includeSeparator, path, root],
  );

  if (items.length === 0) return null;

  return (
    <div
      {...props}
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}
    >
      {items.map((item, index) => {
        const itemClassName = cn(
          "truncate",
          index === items.length - 1 && "font-medium text-primary",
        );

        return (
          <Fragment key={`${item.url ?? item.name}-${index}`}>
            {index !== 0 && <RiArrowRightSLine className="size-3.5 shrink-0" />}
            {item.url ? (
              <Link
                href={item.url}
                className={cn(itemClassName, "transition-opacity hover:opacity-80")}
              >
                {item.name}
              </Link>
            ) : (
              <span className={itemClassName}>{item.name}</span>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

function DocsFooter({ className, ...props }: ComponentProps<"div">) {
  const pathname = usePathname();
  const { root } = useTreeContext();
  const footerList = useMemo(() => flattenFooterItems(root.children), [root.children]);
  const index = footerList.findIndex((item) => item.url === pathname);
  const previous = index > 0 ? footerList[index - 1] : undefined;
  const next = index >= 0 ? footerList[index + 1] : undefined;

  if (!previous && !next) return null;

  return (
    <div
      {...props}
      className={cn(
        "@container mt-8 grid gap-4",
        previous && next ? "grid-cols-2" : "grid-cols-1",
        className,
      )}
    >
      {previous && <DocsFooterItem item={previous} index={0} />}
      {next && <DocsFooterItem item={next} index={1} />}
    </div>
  );
}

function DocsFooterItem({ item, index }: { item: FooterItem; index: 0 | 1 }) {
  const Icon = index === 0 ? RiArrowLeftSLine : RiArrowRightSLine;

  return (
    <Link
      href={item.url}
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-4 text-sm transition-colors hover:bg-accent/80 hover:text-accent-foreground @max-lg:col-span-full",
        index === 1 && "text-end",
      )}
    >
      <div
        className={cn(
          "inline-flex items-center gap-1.5 font-medium",
          index === 1 && "flex-row-reverse",
        )}
      >
        <Icon className="-mx-1 size-4 shrink-0" />
        <p>{item.name}</p>
      </div>
      <p className="truncate text-muted-foreground">
        {item.description ?? (index === 0 ? "Previous page" : "Next page")}
      </p>
    </Link>
  );
}

type FooterItem = Pick<PageTree.Item, "description" | "name" | "url">;

function flattenFooterItems(nodes: PageTree.Node[]): FooterItem[] {
  const items: FooterItem[] = [];

  for (const node of nodes) {
    if (node.type === "page" && node.url !== "#") {
      items.push({
        description: node.description,
        name: node.name,
        url: node.url,
      });
      continue;
    }

    if (node.type === "folder") {
      items.push(...flattenFooterItems(node.children));
    }
  }

  return items;
}
