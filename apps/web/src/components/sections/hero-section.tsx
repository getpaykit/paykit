import { Section, SectionContent } from "@/components/layout/section";
import { heroConfigCode, heroPaykitCode } from "@/components/sections/readme-code-content";
import { CodeBlockContent } from "@/components/ui/code-block-content";
import { HeroCodeBlock } from "@/components/web/hero-code-block";
import { HeroTitle } from "@/components/web/hero-title";

const codeBlockOverrides = {
  className:
    "border-0 my-0 h-full w-full min-w-0 shadow-none bg-card! [&_div]:bg-card! max-sm:[&_.line::after]:!hidden max-sm:[&_.line]:!pl-3 sm:[&_.line::after]:w-4 sm:[&_.line::after]:text-right sm:[&_.line::after]:left-2",
  keepBackground: false,
  viewportProps: {
    className:
      "h-full w-full min-w-0 overflow-x-auto overflow-y-hidden overscroll-x-none max-h-none",
  },
} as const;

export function HeroSection() {
  return (
    <Section>
      <SectionContent className="pt-14 sm:pt-16 lg:pt-32 pb-16 lg:pb-20">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="lg:min-w-0 lg:basis-[45%] lg:max-w-none">
            <HeroTitle />
          </div>

          <div className="flex w-full justify-center lg:min-w-0 lg:basis-[57%] lg:justify-end">
            <HeroCodeBlock
              plansCodeBlock={
                <CodeBlockContent
                  lang="ts"
                  code={heroPaykitCode}
                  codeblock={codeBlockOverrides}
                  allowCopy={false}
                />
              }
              configCodeBlock={
                <CodeBlockContent
                  lang="ts"
                  code={heroConfigCode}
                  codeblock={codeBlockOverrides}
                  allowCopy={false}
                />
              }
            />
          </div>
        </div>
      </SectionContent>
    </Section>
  );
}
