import { DemoSection } from "@/components/sections/demo-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { FooterSection } from "@/components/sections/footer-section";
import { HeroSection } from "@/components/sections/hero-section";
import { demoSnippets } from "@/components/sections/readme-code-content";
import { InlineCode } from "@/components/ui/code-block-content";
import { homePageStructuredData } from "@/lib/consts";

export default function HomePage() {
  return (
    <>
      {homePageStructuredData.map((schema, index) => (
        <script
          key={`${schema["@type"]}-${index}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
      <div className="relative pt-[45px] lg:pt-0">
        <HeroSection />
        <DemoSection
          snippets={{
            subscribe: <InlineCode lang="ts" code={demoSnippets.subscribe} />,
            check: <InlineCode lang="ts" code={demoSnippets.check} />,
            report: <InlineCode lang="ts" code={demoSnippets.report} />,
            portal: <InlineCode lang="ts" code={demoSnippets.portal} />,
            downgrade: <InlineCode lang="ts" code={demoSnippets.downgrade} />,
            resubscribe: <InlineCode lang="ts" code={demoSnippets.resubscribe} />,
          }}
        />
        <FeaturesSection />
        <FooterSection />
      </div>
    </>
  );
}
