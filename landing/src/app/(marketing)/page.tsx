import { HeroTitle } from "@/components/landing/hero-title";
import { ReadmeMotion } from "@/components/landing/readme-motion";
import { ConfigurationSection } from "@/components/sections/configuration-section";
import { DescriptionSection } from "@/components/sections/description-section";
import { FeaturesSection } from "@/components/sections/features-section";
import { FooterSection } from "@/components/sections/footer-section";
import {
  codeExamples,
  handlerCode,
  serverCode,
  sharedCodeBlockProps,
} from "@/components/sections/readme-code-content";
import { UnifiedApiSection } from "@/components/sections/unified-api-section";
import { HighlightedCodeBlock } from "@/components/ui/highlighted-code-block";
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
      <div id="hero" className="relative pt-[45px] lg:pt-0">
        {/* Grid background */}
        <div
          className="hero-dots pointer-events-none absolute inset-0 select-none"
          aria-hidden="true"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-foreground) 1.2px, transparent 1.2px)",
            backgroundSize: "16px 16px",
            opacity: 0.09,
          }}
        />
        <div className="text-foreground relative">
          <div className="mx-auto flex w-full max-w-[60rem] flex-col">
            <HeroTitle />
            <ReadmeMotion>
              <h2 className="border-foreground/10 mb-4 flex items-center gap-2 border-b pb-2 font-mono text-sm text-neutral-800 sm:mb-5 sm:pb-3 sm:text-base dark:text-neutral-200">
                README
              </h2>
              <DescriptionSection />
              <ConfigurationSection
                handlerCodeBlock={
                  <HighlightedCodeBlock
                    lang="ts"
                    code={handlerCode}
                    codeblock={sharedCodeBlockProps}
                  />
                }
                serverCodeBlock={
                  <HighlightedCodeBlock
                    lang="ts"
                    code={serverCode}
                    codeblock={sharedCodeBlockProps}
                  />
                }
              />
              <FeaturesSection />
              <UnifiedApiSection
                tabs={Object.entries(codeExamples).map(([name, code]) => ({
                  name,
                  content: (
                    <HighlightedCodeBlock lang="ts" code={code} codeblock={sharedCodeBlockProps} />
                  ),
                }))}
              />
              <FooterSection />
            </ReadmeMotion>
          </div>
        </div>
      </div>
    </>
  );
}
