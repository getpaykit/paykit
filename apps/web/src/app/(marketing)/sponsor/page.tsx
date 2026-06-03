import type { Metadata } from "next";
import Link from "next/link";

import { Section, SectionContent } from "@/components/layout/section";
import { FooterSection } from "@/components/sections/footer-section";

const sponsorUrl = "https://opencollective.com/maxktz";

export const metadata: Metadata = {
  title: "Sponsor",
  description: "Support PayKit development through Open Collective.",
  alternates: {
    canonical: "/sponsor",
  },
};

export default function SponsorPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <meta httpEquiv="refresh" content={`1;url=${sponsorUrl}`} />

      <Section className="flex-1">
        <SectionContent className="px-12 pt-24 pb-24 sm:pt-24 sm:pb-24 md:pt-32 md:pb-24 lg:px-12 lg:pt-36 lg:pb-24">
          <div className="mx-auto max-w-2xl text-center">
            <div className="space-y-4">
              <h1 className="text-foreground/90 text-3xl font-semibold tracking-tight sm:text-4xl">
                Redirecting to Open Collective...
              </h1>
              <p className="text-foreground/45 mx-auto max-w-xl text-sm leading-relaxed sm:text-base">
                Support ongoing PayKit development on Open Collective. If you are not redirected
                automatically, use the fallback link below.
              </p>
            </div>

            <div className="mt-8">
              <Link
                href={sponsorUrl}
                className="text-foreground/45 hover:text-foreground/70 font-mono text-sm transition-colors"
              >
                Continue to Open Collective
              </Link>
            </div>
          </div>
        </SectionContent>
      </Section>

      <FooterSection />
    </div>
  );
}
