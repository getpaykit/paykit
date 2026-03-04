"use client";

import type { ReactNode } from "react";

import {
  CreemLogo,
  LemonSqueezyLogo,
  PaddleLogo,
  PayPalLogo,
  PolarLogo,
  StripeLogo,
} from "../landing/provider-logos";

const providers: { name: string; icon: ReactNode }[] = [
  { name: "Paddle", icon: <PaddleLogo className="-mx-0.5 h-5.5" /> },
  { name: "Stripe", icon: <StripeLogo className="h-5" /> },
  { name: "Creem", icon: <CreemLogo className="h-4.5" /> },
  { name: "PayPal", icon: <PayPalLogo className="h-4.5" /> },
  { name: "Lemon Squeezy", icon: <LemonSqueezyLogo className="-mx-1 h-4.5" /> },
  { name: "Polar", icon: <PolarLogo className="mb-0.5 h-5.5" /> },
];

function ProviderItem({ icon }: { icon: ReactNode }) {
  return (
    <div className="text-foreground/60 dark:text-foreground/40 flex shrink-0 items-center gap-2">
      <span className="shrink-0">{icon}</span>
    </div>
  );
}

export function ProvidersSection() {
  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage: "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 15%, black 85%, transparent)",
      }}
    >
      <div className="animate-logo-marquee flex w-fit">
        {[0, 1, 2].map((setIdx) => (
          <div key={setIdx} className="flex shrink-0 gap-10 pr-10">
            {providers.map((provider, i) => (
              <ProviderItem key={`${setIdx}-${i}-${provider.name}`} icon={provider.icon} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
