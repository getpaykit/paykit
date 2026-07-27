import type { Metadata } from "next";

import { Section, SectionContent } from "@/components/layout/section";
import { FooterSection } from "@/components/sections/footer-section";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Get in touch",
  description:
    "Get in touch with the PayKit team about your billing setup, onboarding, or integrations.",
  alternates: {
    canonical: "/contact",
  },
};

export default function ContactPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Section className="flex-1">
        <SectionContent className="px-12 pt-24 pb-24 sm:pt-24 sm:pb-24 md:pt-32 md:pb-24 lg:px-12 lg:pt-36 lg:pb-24">
          <div className="mx-auto max-w-lg">
            <div className="space-y-3 text-center">
              <h1 className="text-foreground/90 text-2xl font-semibold tracking-tight sm:text-3xl">
                Get in touch
              </h1>
              <p className="text-foreground/45 text-sm leading-relaxed sm:text-base">
                Reach out to the PayKit team about your billing setup, onboarding, or custom
                integrations.
              </p>
            </div>

            <div className="mt-12">
              <ContactForm />
            </div>
          </div>
        </SectionContent>
      </Section>
      <FooterSection />
    </div>
  );
}
