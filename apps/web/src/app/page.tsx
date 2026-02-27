import { CodeShowcaseSection } from "@/components/sections/code-showcase-section";
import { FooterCtaSection } from "@/components/sections/footer-cta-section";
import { HeaderSection } from "@/components/sections/header-section";
import { HeroSection } from "@/components/sections/hero-section";
import { SiteFooterSection } from "@/components/sections/site-footer-section";
import { WhySection } from "@/components/sections/why-section";

export default function Page() {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex flex-col">
      <HeaderSection />
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
