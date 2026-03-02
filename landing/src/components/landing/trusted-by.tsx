"use client";

import type { ReactNode } from "react";
import {
  LemonSqueezyLogo,
  PaddleLogo,
  PayPalLogo,
  PolarLogo,
  StripeLogo,
} from "./provider-logos";

const providers: { name: string; icon: ReactNode }[] = [
  { name: "Stripe", icon: <StripeLogo className="h-5" /> },
  { name: "PayPal", icon: <PayPalLogo className="h-[18px]" /> },
  { name: "Paddle", icon: <PaddleLogo className="h-[22px]" /> },
  { name: "Polar", icon: <PolarLogo className="h-[22px] mb-0.5" /> },
  { name: "Lemon Squeezy", icon: <LemonSqueezyLogo className="h-[18px]" /> },
];

function ProviderItem({ icon }: { icon: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-5 shrink-0 text-foreground/60 dark:text-foreground/40">
      <span className="shrink-0">{icon}</span>
    </div>
  );
}

export function TrustedBy() {
  return (
    <div className="space-y-3">
      <div className="relative overflow-x-clip">
        <div
          className="pointer-events-none absolute inset-0 z-10"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
            WebkitMaskImage:
              "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
          }}
        >
          <div className="flex animate-logo-marquee w-fit">
            {[0, 1].map((setIdx) => (
              <div key={setIdx} className="flex shrink-0">
                {providers.map((provider, i) => (
                  <ProviderItem
                    key={`${setIdx}-${i}-${provider.name}`}
                    icon={provider.icon}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Invisible spacer to maintain height */}
        <div className="flex invisible" aria-hidden="true">
          {providers.slice(0, 1).map((provider, i) => (
            <ProviderItem key={`spacer-${i}`} icon={provider.icon} />
          ))}
        </div>
      </div>
    </div>
  );
}
