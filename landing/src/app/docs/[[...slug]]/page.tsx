import { Callout } from "fumadocs-ui/components/callout";
import { Card, Cards } from "fumadocs-ui/components/card";
import { Step, Steps } from "fumadocs-ui/components/steps";
import { Tab, Tabs } from "fumadocs-ui/components/tabs";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { TocProgressFooter } from "@/components/docs/toc-progress-footer";
import { source } from "@/lib/source";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
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
        footer: <TocProgressFooter />,
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
