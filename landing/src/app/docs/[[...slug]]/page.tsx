import { Callout as BaseCallout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ComponentPropsWithoutRef } from "react";

import { TocFooter } from "@/components/docs/toc-footer";
import { source } from "@/lib/source";
import { cn } from "@/lib/utils";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

function Callout(props: ComponentPropsWithoutRef<typeof BaseCallout>) {
  return <BaseCallout {...props} className={cn("rounded-lg", props.className)} />;
}

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    redirect("/docs/get-started");
  }

  const page = source.getPage(slug ?? []);

  if (!page) notFound();

  const MDXContent = page.data.body;
  const showBreadcrumb = (slug?.length ?? 0) >= 3;

  return (
    <DocsPage
      breadcrumb={{
        enabled: showBreadcrumb,
      }}
      toc={page.data.toc}
      full={page.data.full}
      tableOfContent={{
        footer: <TocFooter />,
        style: "clerk",
      }}
      tableOfContentPopover={{
        style: "clerk",
      }}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={{
            ...defaultMdxComponents,
            h1: ({ children, ...props }: ComponentPropsWithoutRef<"h1">) => (
              <h2 {...props}>{children}</h2>
            ),
            Callout,
            Card,
            Cards,
            Step,
            Steps,
            Tab,
            Tabs,
          }}
        />
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
  };
}
