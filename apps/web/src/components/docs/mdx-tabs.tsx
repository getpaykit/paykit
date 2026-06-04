"use client";

import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

interface MdxTabsContextValue {
  items?: string[];
}

const MdxTabsContext = createContext<MdxTabsContextValue | null>(null);

function getDefaultValue(items?: string[], defaultIndex = 0, defaultValue?: string) {
  return defaultValue ?? items?.[defaultIndex];
}

export interface MdxTabsProps extends Omit<TabsPrimitive.Root.Props, "value" | "onValueChange"> {
  items?: string[];
  defaultIndex?: number;
  defaultValue?: string;
  label?: ReactNode;
}

export function MdxTabs({
  className,
  items,
  defaultIndex = 0,
  defaultValue,
  label,
  children,
  ...props
}: MdxTabsProps) {
  const [value, setValue] = useState(() => getDefaultValue(items, defaultIndex, defaultValue));
  const context = useMemo(() => ({ items }), [items]);

  return (
    <TabsPrimitive.Root
      className={cn("flex flex-col gap-2 data-[orientation=vertical]:flex-row", className)}
      data-slot="tabs"
      value={value}
      onValueChange={(nextValue) => {
        if (items && !items.includes(nextValue)) return;
        setValue(nextValue);
      }}
      {...props}
    >
      {items ? (
        <MdxTabsList>
          {label ? <span className="my-auto me-auto text-sm font-medium">{label}</span> : null}
          {items.map((item) => (
            <MdxTabsTab key={item} value={item}>
              {item}
            </MdxTabsTab>
          ))}
        </MdxTabsList>
      ) : null}
      <MdxTabsContext.Provider value={context}>{children}</MdxTabsContext.Provider>
    </TabsPrimitive.Root>
  );
}

export function MdxTabsList({
  indicatorClassName,
  className,
  children,
  ...props
}: TabsPrimitive.List.Props & {
  indicatorClassName?: string;
}) {
  return (
    <TabsPrimitive.List
      className={cn(
        "text-muted-foreground relative z-0 ml-1 flex w-fit items-center justify-center gap-x-0.5",
        "data-[orientation=vertical]:flex-col",
        "*:data-[slot=tabs-trigger]:hover:bg-accent/50 data-[orientation=horizontal]:py-1 data-[orientation=vertical]:px-1",
        className,
      )}
      data-slot="tabs-list"
      {...props}
    >
      {children}
      <TabsPrimitive.Indicator
        className={cn(
          "absolute bottom-0 left-0 h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) -translate-y-(--active-tab-bottom) transition-[width,translate] duration-200 ease-in-out",
          "bg-primary! z-10 data-[orientation=horizontal]:h-px data-[orientation=horizontal]:translate-y-px data-[orientation=vertical]:w-0.5 data-[orientation=vertical]:-translate-x-px",
          indicatorClassName,
        )}
        data-slot="tab-indicator"
      />
    </TabsPrimitive.List>
  );
}

export function MdxTabsTab({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      className={cn(
        "focus-visible:ring-ring select-none flex shrink-0 grow cursor-pointer items-center justify-center rounded-sm text-xs font-medium whitespace-nowrap transition-[color,background-color,box-shadow] outline-none focus-visible:ring-2 data-disabled:pointer-events-none data-disabled:opacity-64 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4",
        "hover:text-primary data-active:text-foreground",
        "h-6 gap-1.5 px-[calc(--spacing(2)-1px)]",
        "data-[orientation=vertical]:w-full data-[orientation=vertical]:justify-start",
        className,
      )}
      data-slot="tabs-trigger"
      {...props}
    />
  );
}

export function MdxTabsPanel({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      className={cn(
        "relative flex-1 outline-none [&>.not-fumadocs-codeblock:first-child]:mt-0 [&_h3]:text-base [&_h3]:font-medium [&>.steps]:mt-6",
        className,
      )}
      data-slot="tabs-content"
      {...props}
    />
  );
}

export function MdxTab({ value, ...props }: ComponentProps<typeof MdxTabsPanel>) {
  const context = useContext(MdxTabsContext);
  const resolvedValue = value ?? context?.items?.[0];

  if (!resolvedValue) {
    throw new Error("Failed to resolve tab value. Pass a value prop to <Tab>.");
  }

  return <MdxTabsPanel value={resolvedValue} {...props} />;
}
