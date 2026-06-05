import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CopyMarkdownButton } from "@/components/docs/copy-markdown-button";
import { docsMdxComponents } from "@/components/docs/docs-mdx-components";
import { DocsBody, DocsDescription, DocsPage, DocsTitle } from "@/components/docs/docs-page";
import { PackageManagerProvider } from "@/components/docs/package-command";
import { fallbackPackageManager } from "@/components/docs/package-manager-state";
import type { SourcePage } from "@/lib/source";
import { source } from "@/lib/source";

interface DocsPageProps {
  params: Promise<{ slug?: string[] }>;
}

export const revalidate = false;

export default async function Page({ params }: DocsPageProps) {
  const { slug } = await params;

  const page = source.getPage(slug ?? []) as SourcePage | undefined;

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
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-4">
        <DocsTitle>{page.data.title}</DocsTitle>
        <div className="hidden md:block">
          <CopyMarkdownButton markdownUrl={`${page.url}.md`} />
        </div>
      </div>
      <DocsDescription>{page.data.description}</DocsDescription>
      <div className="mt-3 self-start md:hidden">
        <CopyMarkdownButton markdownUrl={`${page.url}.md`} />
      </div>
      <DocsBody>
        <PackageManagerProvider initialManager={fallbackPackageManager}>
          <MDXContent components={docsMdxComponents} />
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

  const page = source.getPage(slug ?? []);

  if (!page) notFound();

  const ogPath = slug?.length ? `/${slug.join("/")}` : "";

  return {
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      title: page.data.title,
      description: page.data.description,
      images: [
        {
          url: `/api/og${ogPath}`,
          width: 1200,
          height: 600,
          alt: page.data.title,
        },
      ],
    },
    twitter: {
      title: page.data.title,
      description: page.data.description,
      images: [`/api/og${ogPath}`],
    },
  };
}
