import { CodeShowcaseSection } from "@/components/sections/code-showcase-section";
import { FooterCtaSection } from "@/components/sections/footer-cta-section";
import { HeroSection } from "@/components/sections/hero-section";
import { SiteFooterSection } from "@/components/sections/site-footer-section";
import { WhySection } from "@/components/sections/why-section";

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <main className="flex-1">
        <HeroSection />
        <WhySection />
        <CodeShowcaseSection />
        <FooterCtaSection />
      </main>
      <SiteFooterSection />
    </div>
  );
}
