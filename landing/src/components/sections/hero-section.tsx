import { HeroCodeBlock } from "@/components/landing/hero-code-block";
import { HeroTitle } from "@/components/landing/hero-title";
import { Section, SectionContent } from "@/components/layout/section";
import { heroConfigCode, heroPaykitCode } from "@/components/sections/readme-code-content";
import { CodeBlockContent } from "@/components/ui/code-block-content";

const codeBlockOverrides = {
  className:
    "border-0 my-0 shadow-none bg-card! [&_div]:bg-card! [&_.line::after]:w-4 [&_.line::after]:text-right [&_.line::after]:left-2",
  keepBackground: false,
  viewportProps: {
    className: "overflow-x-hidden overflow-y-visible max-h-none",
  },
} as const;

export function HeroSection() {
  return (
    <Section label="01 Hero">
      <SectionContent className="pt-24 lg:pt-36 pb-24 px-12">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:max-w-lg">
            <HeroTitle />
          </div>

          <HeroCodeBlock
            plansCodeBlock={
              <CodeBlockContent lang="ts" code={heroPaykitCode} codeblock={codeBlockOverrides} />
            }
            configCodeBlock={
              <CodeBlockContent lang="ts" code={heroConfigCode} codeblock={codeBlockOverrides} />
            }
          />
        </div>
      </SectionContent>
    </Section>
  );
}
