import { Callout as BaseCallout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";
import { RiLinkM } from "react-icons/ri";

import { CopyMarkdownButton } from "@/components/docs/copy-markdown-button";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "@/components/docs/docs-page";
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
import { PackageManagerProvider } from "@/components/docs/package-command";
import { PackageCommandPre } from "@/components/docs/package-command-pre";
import {
  packageManagerCookieName,
  parsePackageManagerCookie,
} from "@/components/docs/package-manager-state";
import type { SourcePage } from "@/lib/source";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

function Callout(props: ComponentPropsWithoutRef<typeof BaseCallout>) {
  return (
    <BaseCallout
      {...props}
      className={cn("bg-secondary/90 rounded-sm border-none shadow-none", props.className)}
    />
  );
}

function Paragraph({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return <p {...props} className={cn("leading-relaxed not-first:mt-4.5", className)} />;
}

function Strong({ className, ...props }: ComponentPropsWithoutRef<"strong">) {
  return <strong {...props} className={cn("font-medium", className)} />;
}

function getHeadingId(children: ComponentPropsWithoutRef<"h2">["children"]) {
  return children?.toString().replace(/ /g, "-").replace(/'/g, "").replace(/\?/g, "").toLowerCase();
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
  const headingId = getHeadingId(props.children);

  return (
    <a
      href={`#${headingId}`}
      className="not-prose group text-primary relative mt-10 block no-underline first:mt-0 [&+.steps]:mt-0! [&+.steps>h3]:mt-4! [&+h3]:mt-6! [&+p]:mt-4!"
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
        "not-prose font-heading text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none [&+p]:mt-4! *:[code]:text-xl",
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
        "not-prose font-heading text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none",
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
        "not-prose text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none",
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
        "not-prose text-primary mt-8 scroll-m-10 text-base font-medium tracking-tight select-none",
        className,
      )}
    />
  );
}

function UnorderedList({ className, ...props }: ComponentPropsWithoutRef<"ul">) {
  return <ul {...props} className={cn("my-6 ml-6 list-disc", className)} />;
}

function OrderedList({ className, ...props }: ComponentPropsWithoutRef<"ol">) {
  return <ol {...props} className={cn("my-6 ml-6 list-decimal", className)} />;
}

function ListItem({ className, ...props }: ComponentPropsWithoutRef<"li">) {
  return <li {...props} className={cn("mt-2", className)} />;
}

function Blockquote({ className, ...props }: ComponentPropsWithoutRef<"blockquote">) {
  return <blockquote {...props} className={cn("mt-6 border-l-2 pl-6 italic", className)} />;
}

function HorizontalRule(props: ComponentPropsWithoutRef<"hr">) {
  return <hr {...props} className={cn("my-4 md:my-8", props.className)} />;
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
        "px-4 py-2 text-left font-bold [[align=center]]:text-center [[align=right]]:text-right",
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

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    redirect("/docs/get-started");
  }

  const page = source.getPage(slug ?? []) as SourcePage | undefined;

  if (!page) notFound();

  const MDXContent = page.data.body;
  const showBreadcrumb = (slug?.length ?? 0) >= 3;
  const cookieStore = await cookies();
  const packageManager = parsePackageManagerCookie(
    cookieStore.get(packageManagerCookieName)?.value,
  );

  return (
    <DocsPage
      breadcrumb={{
        enabled: showBreadcrumb,
      }}
      toc={page.data.toc}
      full={page.data.full}
    >
      <div className="flex items-start justify-between gap-4">
        <DocsTitle>{page.data.title}</DocsTitle>
        <CopyMarkdownButton markdownUrl={`${page.url}.md`} />
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <PackageManagerProvider initialManager={packageManager}>
          <MDXContent
            components={{
              ...defaultMdxComponents,
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
              code: ({ children, ...props }: ComponentPropsWithoutRef<"code">) => {
                if (typeof children === "string") {
                  return <InlineCode {...props}>{children}</InlineCode>;
                }

                return <code {...props}>{children}</code>;
              },
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
            }}
          />
        </PackageManagerProvider>
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({ params }: DocsPageProps): Promise<Metadata> {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    return {
      title: "Documentation",
      description: "PayKit documentation",
    };
  }

  const page = source.getPage(slug ?? []);

  if (!page) notFound();

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      images: [
        {
          url: `/api/og/${slug.join("/")}`,
          width: 1200,
          height: 600,
          alt: page.data.title,
        },
      ],
    },
    twitter: {
      title: page.data.title,
      description: page.data.description,
      images: [`/api/og/${slug.join("/")}`],
    },
  };
}
