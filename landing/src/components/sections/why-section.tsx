import {
  DatabaseIcon,
  Plug01Icon,
  SquareUnlock02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type * as React from "react";

import { cn } from "@/lib/utils";

interface WhyCard {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const cards: WhyCard[] = [
  {
    icon: <HugeiconsIcon icon={SquareUnlock02Icon} size={20} />,
    title: "No vendor lock-in.",
    description:
      "Subscriptions, invoices, and usage live in your DB. Swap providers without rewriting billing logic.",
  },
  {
    icon: <HugeiconsIcon icon={DatabaseIcon} size={20} />,
    title: "No product catalog syncing.",
    description:
      "Pass amounts inline. Your app owns its products — PayKit doesn't need to know about them.",
  },
  {
    icon: <HugeiconsIcon icon={Plug01Icon} size={20} />,
    title: "Tiny provider contract.",
    description: "5 methods. Adding a new provider takes an afternoon.",
  },
];

export function WhySection() {
  return (
    <section>
      <div className="section-container py-24 border-b border-border">
        <h2 className="section-title text-center">
          Providers are payment rails.
          <br />
          Your database owns the rest.
        </h2>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 border border-border">
          {cards.map((card, index) => (
            <div
              key={card.title}
              className={cn(
                "p-8",
                index > 0 &&
                  "border-t border-border md:border-t-0 md:border-l md:border-border",
              )}
            >
              <div className="mb-4 text-muted-foreground">{card.icon}</div>
              <h3 className="text-sm font-semibold text-foreground">
                {card.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
