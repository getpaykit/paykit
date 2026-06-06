"use client";

import { Menu02Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import * as Primitive from "fumadocs-core/toc";
import { useTOCItems } from "fumadocs-ui/components/toc";
import type { ComponentProps, ReactNode } from "react";
import { useCallback, useEffect, useRef, useState } from "react";

import { extractText } from "@/components/docs/react-node-text";
import { cn } from "@/lib/utils";

interface ComputedPath {
  content: ReactNode;
  d: string;
  height: number;
  positions: [top: number, bottom: number][];
  width: number;
}

const lineBaseOffset = 7;

function getItemOffset(depth: number) {
  if (depth <= 2) return 18;
  if (depth === 3) return 30;
  return 42;
}

function getLineOffset(depth: number) {
  if (depth <= 2) return lineBaseOffset;
  if (depth === 3) return lineBaseOffset + 10;
  return lineBaseOffset + 20;
}

function DocsTocItems({ className, children, ...props }: ComponentProps<"div">) {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useTOCItems();
  const tocInfo = Primitive.useTOC();
  const [path, setPath] = useState<ComputedPath | null>(null);

  const calculatePath = useCallback(() => {
    const container = containerRef.current;
    if (!container || container.clientHeight === 0 || items.length === 0) {
      setPath(null);
      return;
    }

    let d = "";
    let height = 0;
    let width = 0;
    const positions: [top: number, bottom: number][] = [];

    for (let index = 0; index < items.length; index++) {
      const item = items[index];
      if (!item) continue;

      const element: HTMLElement | null = container.querySelector(`a[href="${item.url}"]`);
      if (!element) continue;

      const styles = getComputedStyle(element);
      const x = getLineOffset(item.depth) + 0.5;
      const top = element.offsetTop + parseFloat(styles.paddingTop);
      const bottom = element.offsetTop + element.clientHeight - parseFloat(styles.paddingBottom);
      const previous = positions[index - 1];
      const previousItem = items[index - 1];
      const previousX = index > 0 && previousItem ? getLineOffset(previousItem.depth) + 0.5 : x;

      if (index === 0 || !previous) {
        d += `M${x} ${top} L${x} ${bottom}`;
      } else {
        d += ` C ${previousX} ${top - 4} ${x} ${previous[1] + 4} ${x} ${top} L${x} ${bottom}`;
      }

      width = Math.max(width, x + 8);
      height = Math.max(height, bottom);
      positions.push([top, bottom]);
    }

    setPath({
      content: <path d={d} strokeWidth="1" fill="none" />,
      d,
      height,
      positions,
      width,
    });
  }, [items]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(calculatePath);
    observer.observe(container);
    calculatePath();

    return () => observer.disconnect();
  }, [calculatePath]);

  return (
    <div ref={containerRef} className={cn("relative flex flex-col", className)} {...props}>
      {path ? <DocsTocTrack path={path} items={tocInfo.get()} /> : null}
      {children}
    </div>
  );
}

function getLastActiveIndex(items: Primitive.TOCItemInfo[]) {
  for (let index = items.length - 1; index >= 0; index--) {
    if (items[index]?.active) return index;
  }

  return -1;
}

function DocsTocTrack({ path, items }: { path: ComputedPath; items: Primitive.TOCItemInfo[] }) {
  const ref = useRef<HTMLDivElement>(null);

  const calculateActiveStyle = useCallback(() => {
    const activeStart = items.findIndex((item) => item.active);
    if (activeStart === -1) return {};

    const activeEnd = getLastActiveIndex(items);

    return {
      "--track-top": `${path.positions[activeStart]?.[0] ?? 0}px`,
      "--track-bottom": `${path.positions[activeEnd]?.[1] ?? 0}px`,
    } as Record<string, string>;
  }, [items, path.positions]);

  Primitive.useTOCListener((nextItems) => {
    const element = ref.current;
    if (!element) return;

    const activeStart = nextItems.findIndex((item) => item.active);
    const activeEnd = getLastActiveIndex(nextItems);

    element.style.setProperty("--track-top", `${path.positions[activeStart]?.[0] ?? 0}px`);
    element.style.setProperty("--track-bottom", `${path.positions[activeEnd]?.[1] ?? 0}px`);
  });

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="text-path pointer-events-none absolute top-0 left-0"
      style={{ width: path.width, height: path.height, ...calculateActiveStyle() }}
    >
      <svg viewBox={`0 0 ${path.width} ${path.height}`} className="absolute overflow-visible">
        <g className="stroke-current">{path.content}</g>
      </svg>
      <svg
        viewBox={`0 0 ${path.width} ${path.height}`}
        className="absolute overflow-visible transition-[clip-path] duration-150"
        style={{
          clipPath:
            "polygon(0 var(--track-top,0), 100% var(--track-top,0), 100% var(--track-bottom,0), 0 var(--track-bottom,0))",
        }}
      >
        <g className="stroke-primary">{path.content}</g>
      </svg>
    </div>
  );
}

function DocsTocItem({ item }: { item: Primitive.TOCItemType }) {
  return (
    <Primitive.TOCItem
      href={item.url}
      className={cn(
        "relative py-1 text-[13px] leading-5 text-muted-foreground/75 no-underline transition-colors hover:text-foreground data-[active=true]:text-foreground/95",
      )}
      style={{ paddingInlineStart: getItemOffset(item.depth) }}
    >
      {extractText(item.title)}
    </Primitive.TOCItem>
  );
}

/** Custom docs table of contents with path-style active tracking. */
export function DocsToc({ className, footer }: { className?: string; footer?: ReactNode }) {
  const items = useTOCItems();
  const scrollRef = useRef<HTMLDivElement>(null);

  if (items.length === 0 && !footer) {
    return <div id="nd-toc-placeholder" className="hidden xl:layout:[--fd-toc-width:250px]" />;
  }

  return (
    <div
      id="nd-toc"
      className={cn(
        "sticky top-(--fd-docs-row-1) flex h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))] w-(--fd-toc-width) flex-col pt-14 pr-4 pb-2 [grid-area:toc] max-xl:hidden xl:layout:[--fd-toc-width:250px]",
        className,
      )}
    >
      <h3
        id="toc-title"
        className="inline-flex items-center gap-1.5 pl-0.5 text-[13px] text-muted-foreground/75"
      >
        <HugeiconsIcon size={14} icon={Menu02Icon} />
        On this page
      </h3>
      <div
        ref={scrollRef}
        className="relative min-h-0 overflow-auto py-2 text-sm [scrollbar-width:none]"
      >
        <Primitive.ScrollProvider containerRef={scrollRef}>
          <DocsTocItems>
            {items.map((item) => (
              <DocsTocItem key={item.url} item={item} />
            ))}
          </DocsTocItems>
        </Primitive.ScrollProvider>
      </div>
      {footer}
    </div>
  );
}
