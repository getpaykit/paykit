import type { Metadata } from "next";
import Link from "next/link";
import { RiArrowLeftLine } from "react-icons/ri";

import { Section, SectionContent } from "@/components/layout/section";
import { Button } from "@/components/ui/button";

/**
 * Blog placeholder SEO metadata.
 *
 * @type {Metadata}
 * Contains the page title, description, and canonical route.
 */
export const metadata: Metadata = {
  title: "Blog",
  description: "PayKit blog is coming soon.",
  alternates: {
    canonical: "/blog",
  },
};

/** Marketing blog landing page placeholder.
 *
 * @returns JSX.Element
 */
export default function BlogPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Section last className="flex-1">
        <SectionContent className="relative flex min-h-dvh flex-col items-center justify-center">
          <div className="relative flex flex-col items-center gap-4 text-center">
            <p className="text-foreground/30 font-mono text-xs tracking-widest uppercase">
              Coming soon
            </p>
            <h1 className="text-foreground text-2xl font-medium tracking-tight sm:text-3xl">
              Blog is not ready yet
            </h1>
            <p className="text-foreground/50 max-w-sm text-sm">
              Notes, guides, engineering deep dives, and product updates will land here soon.
            </p>
            <div className="pt-2">
              <Button size="lg" render={<Link href="/" />} nativeButton={false}>
                <RiArrowLeftLine />
                Go home
              </Button>
            </div>
          </div>
        </SectionContent>
      </Section>
    </div>
  );
}
