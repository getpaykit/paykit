import type { MDXComponents } from "mdx/types";
import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiErrorWarningFill,
  RiInformationFill,
  RiLinkM,
} from "react-icons/ri";

import { Features } from "@/components/docs/features";
import { MdxTab, MdxTabs, MdxTabsList, MdxTabsPanel, MdxTabsTab } from "@/components/docs/mdx-tabs";
import {
  Anchor,
  InlineCode,
  MDXLink,
  Step,
  StepContent,
  StepDescription,
  Steps,
  StepTitle,
} from "@/components/docs/mdx-text";
import { PackageCommandPre } from "@/components/docs/package-command-pre";
import { cn } from "@/lib/utils";

type DocsCalloutType = "info" | "warn" | "error" | "success";

const calloutStyles = {
  info: {
    icon: RiInformationFill,
    tone: "text-blue-500",
  },
  warn: {
    icon: RiErrorWarningFill,
    tone: "text-amber-500",
  },
  error: {
    icon: RiCloseCircleFill,
    tone: "text-red-500",
  },
  success: {
    icon: RiCheckboxCircleFill,
    tone: "text-emerald-500",
  },
} satisfies Record<DocsCalloutType, { icon: typeof RiInformationFill; tone: string }>;

function Paragraph({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p {...props} className={cn("leading-relaxed not-first:mt-4", className)} />;
}

function Strong({ className, ...props }: ComponentPropsWithoutRef<"strong">) {
  return <strong {...props} className={cn("font-medium", className)} />;
}

function getHeadingId(children: ComponentPropsWithoutRef<"h2">["children"]) {
  return (
    children
      ?.toString()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-") || "heading"
  );
}

function Heading1({ className, children, ...props }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      {...props}
      className={cn(
        "font-heading mt-2 scroll-m-10 text-3xl font-bold tracking-tight select-none",
        className,
      )}
    >
      {children}
    </h1>
  );
}

function Heading2({ className, ...props }: ComponentPropsWithoutRef<"h2">) {
  // Preserve Fumadocs-generated IDs so TOC active tracking stays in sync.
  const headingId = typeof props.id === "string" ? props.id : getHeadingId(props.children);

  return (
    <a
      href={`#${headingId}`}
      className="group text-primary relative mt-8 block no-underline first:mt-0 [&+.steps]:mt-5! [&+h3]:mt-6! [&+p]:mt-4!"
    >
      <RiLinkM className="absolute top-[5px] -left-5 hidden size-4 translate-x-0.5 opacity-0 duration-200 ease-in-out group-hover:-translate-x-0.5 group-hover:opacity-100 lg:block" />
      <h2
        {...props}
        id={headingId}
        className={cn(
          "font-heading [&+]*:[code]:text-xl scroll-m-10 text-xl font-medium tracking-tight select-none",
          className,
        )}
      />
    </a>
  );
}

function Heading3({ className, ...props }: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      {...props}
      className={cn(
        "font-heading text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none [&+p]:mt-4! *:[code]:text-xl",
        className,
      )}
    />
  );
}

function Heading4({ className, ...props }: ComponentPropsWithoutRef<"h4">) {
  return (
    <h4
      {...props}
      className={cn(
        "font-heading text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none",
        className,
      )}
    />
  );
}

function Heading5({ className, ...props }: ComponentPropsWithoutRef<"h5">) {
  return (
    <h5
      {...props}
      className={cn(
        "text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none",
        className,
      )}
    />
  );
}

function Heading6({ className, ...props }: ComponentPropsWithoutRef<"h6">) {
  return (
    <h6
      {...props}
      className={cn(
        "text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none",
        className,
      )}
    />
  );
}

function UnorderedList({ className, ...props }: ComponentPropsWithoutRef<"ul">) {
  return <ul {...props} className={cn("my-4 ml-4 list-disc", className)} />;
}

function OrderedList({ className, ...props }: ComponentPropsWithoutRef<"ol">) {
  return <ol {...props} className={cn("my-4 ml-4 list-decimal", className)} />;
}

function ListItem({ className, ...props }: ComponentPropsWithoutRef<"li">) {
  return <li {...props} className={cn("mt-2", className)} />;
}

function Blockquote({ className, ...props }: ComponentPropsWithoutRef<"blockquote">) {
  return <blockquote {...props} className={cn("mt-6 border-l-2 pl-6 italic", className)} />;
}

function HorizontalRule({ className, ...props }: ComponentPropsWithoutRef<"hr">) {
  return <hr {...props} className={cn("my-4 md:my-8", className)} />;
}

function Table({ className, ...props }: ComponentPropsWithoutRef<"table">) {
  return (
    <div className="no-scrollbar my-6 w-full overflow-y-auto rounded-sm border">
      <table
        {...props}
        className={cn(
          "relative w-full overflow-hidden border-none text-sm [&_tbody_tr:last-child]:border-b-0",
          className,
        )}
      />
    </div>
  );
}

function TableRow({ className, ...props }: ComponentPropsWithoutRef<"tr">) {
  return <tr {...props} className={cn("m-0 border-b", className)} />;
}

function TableHead({ className, ...props }: ComponentPropsWithoutRef<"th">) {
  return (
    <th
      {...props}
      className={cn(
        "px-4 py-2 text-left font-medium [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
    />
  );
}

function TableCell({ className, ...props }: ComponentPropsWithoutRef<"td">) {
  return (
    <td
      {...props}
      className={cn(
        "px-4 py-2 text-left whitespace-nowrap [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
    />
  );
}

function Code({ children, ...props }: ComponentPropsWithoutRef<"code">) {
  if (typeof children === "string") {
    return <InlineCode {...props}>{children}</InlineCode>;
  }

  return <code {...props}>{children}</code>;
}

function Callout({
  className,
  type = "info",
  children,
  ...props
}: ComponentPropsWithoutRef<"div"> & { type?: DocsCalloutType }) {
  const { icon: Icon, tone } = calloutStyles[type];

  return (
    <div
      {...props}
      className={cn("bg-secondary/90 my-3.5 flex gap-2 rounded-sm p-3 ps-1 text-sm", className)}
      data-callout-type={type}
    >
      <div aria-hidden className={cn("w-0.5 shrink-0 rounded-sm bg-current/50", tone)} />
      <Icon aria-hidden className={cn("size-5 shrink-0", tone)} />
      <div className="min-w-0 flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

function Cards({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return <div {...props} className={cn("mt-4 grid gap-3 sm:grid-cols-2", className)} />;
}

function Card({
  className,
  href,
  children,
  ...props
}: ComponentPropsWithoutRef<"div"> & { href?: string; children?: ReactNode }) {
  const content = (
    <div
      {...props}
      className={cn("rounded-sm border bg-background p-4 text-sm leading-relaxed", className)}
    >
      {children}
    </div>
  );

  if (!href) return content;

  return (
    <Link className="block no-underline" href={href}>
      {content}
    </Link>
  );
}

/** MDX component overrides used by documentation pages. Maps standard MDX
 * elements to styled React components and exposes docs-only components such as
 * Callout, Card, Tabs, Steps, and Features. Public API for MDX rendering.
 */
export const docsMdxComponents = {
  pre: PackageCommandPre,
  h1: Heading1,
  h2: Heading2,
  h3: Heading3,
  h4: Heading4,
  h5: Heading5,
  h6: Heading6,
  p: Paragraph,
  strong: Strong,
  a: Anchor,
  code: Code,
  ul: UnorderedList,
  ol: OrderedList,
  li: ListItem,
  blockquote: Blockquote,
  hr: HorizontalRule,
  table: Table,
  tr: TableRow,
  th: TableHead,
  td: TableCell,
  Callout,
  Card,
  Cards,
  Link: MDXLink,
  Step,
  StepContent,
  StepDescription,
  Steps,
  StepTitle,
  Tab: MdxTab,
  Tabs: MdxTabs,
  TabsList: MdxTabsList,
  TabsPanel: MdxTabsPanel,
  TabsTab: MdxTabsTab,
  Features,
} satisfies MDXComponents;
