"use client";

import type { ReactNode } from "react";
import { useState } from "react";

import { CreemLogo, PolarLogo, StripeLogo } from "@/components/landing/provider-logos";
import { SectionContainer } from "@/components/layout/section-container";
import { cn } from "@/lib/utils";

const providers = [
  { id: "stripe", name: "Stripe", logo: <StripeLogo className="h-6 sm:h-7" /> },
  { id: "polar", name: "Polar", logo: <PolarLogo className="h-7 sm:h-8" /> },
  { id: "creem", name: "Creem", logo: <CreemLogo className="h-5.5 sm:h-6.5" /> },
] as const;

type ProviderId = (typeof providers)[number]["id"];

export function ProvidersSection({ codeBlocks }: { codeBlocks: Record<ProviderId, ReactNode> }) {
  const [active, setActive] = useState<ProviderId>("stripe");

  return (
    <SectionContainer className="py-12 lg:py-16">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        {/* Left — narrative + provider cards */}
        <div className="flex shrink-0 flex-col gap-6 lg:w-[340px]">
          <div className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-800 sm:text-xl dark:text-neutral-200">
              One API, any provider
            </h2>
            <p className="text-foreground/50 text-sm leading-relaxed sm:text-base">
              Write your billing logic once. Swap providers by changing a single import — your
              plans, features, and entitlements stay the same.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => setActive(provider.id)}
                className={cn(
                  "border-foreground/[0.08] flex items-center gap-4 border px-5 py-4 text-left transition-all",
                  active === provider.id
                    ? "bg-foreground/[0.04] border-foreground/[0.15] text-foreground/90"
                    : "text-foreground/35 hover:text-foreground/55 hover:bg-foreground/[0.02]",
                )}
              >
                <span className="shrink-0">{provider.logo}</span>
                <span className="text-sm font-medium">{provider.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right — code block */}
        <div className="border-foreground/[0.08] dark:bg-background min-w-0 flex-1 overflow-hidden border bg-neutral-50">
          <div className="border-foreground/[0.08] flex items-center border-b px-4 py-2.5">
            <span className="text-foreground/50 text-[13px]">paykit.ts</span>
          </div>
          {providers.map((provider) => (
            <div key={provider.id} className={active === provider.id ? "block" : "hidden"}>
              {codeBlocks[provider.id]}
            </div>
          ))}
        </div>
      </div>
    </SectionContainer>
  );
}
