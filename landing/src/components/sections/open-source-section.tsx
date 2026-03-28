import { Github } from "lucide-react";

import { SectionContainer } from "@/components/layout/section-container";
import { URLs } from "@/lib/consts";

export function OpenSourceSection() {
  return (
    <SectionContainer className="py-12 lg:py-16">
      <div className="flex flex-col items-center gap-5 text-center">
        <h2 className="text-lg font-semibold tracking-tight text-neutral-800 sm:text-xl dark:text-neutral-200">
          Fully open source
        </h2>
        <p className="text-foreground/50 max-w-md text-sm leading-relaxed sm:text-base">
          Everything is MIT licensed. Framework, dashboard, CLI — no paid tier, no gated features.
          Just billing that works.
        </p>
        <a
          href={URLs.githubRepo}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-foreground text-background inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
        >
          <Github className="size-4" />
          View on GitHub
        </a>
      </div>
    </SectionContainer>
  );
}
