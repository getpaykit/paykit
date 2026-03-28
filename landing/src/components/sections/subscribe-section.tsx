"use client";

import { Check, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

import { SectionContainer } from "@/components/layout/section-container";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    interval: "forever",
    features: ["50 messages/mo", "Community support"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$19",
    interval: "/mo",
    features: ["2,000 messages/mo", "Pro models", "Priority support"],
  },
] as const;

type PlanId = (typeof plans)[number]["id"];

export function SubscribeSection({ codeBlock }: { codeBlock: React.ReactNode }) {
  const [activePlan, setActivePlan] = useState<PlanId>("free");
  const [transitioning, setTransitioning] = useState(false);

  const handleSubscribe = useCallback(
    (planId: PlanId) => {
      if (planId === activePlan || transitioning) return;
      setTransitioning(true);
      setTimeout(() => {
        setActivePlan(planId);
        setTransitioning(false);
      }, 800);
    },
    [activePlan, transitioning],
  );

  return (
    <SectionContainer className="py-12 lg:py-16">
      <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-16">
        {/* Left — code */}
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold tracking-tight text-neutral-800 sm:text-xl dark:text-neutral-200">
              Subscribe in one call
            </h2>
            <p className="text-foreground/50 max-w-md text-sm leading-relaxed sm:text-base">
              New subscriptions, upgrades, and downgrades — all through{" "}
              <code className="text-foreground/70 text-[13px]">paykit.subscribe()</code>. No
              checkout sessions. No webhook wiring.
            </p>
          </div>
          <div className="border-foreground/[0.1] overflow-hidden border">
            <div className="border-foreground/[0.08] flex items-center border-b px-4 py-2">
              <span className="text-foreground/50 text-[13px]">subscribe.ts</span>
            </div>
            {codeBlock}
          </div>
        </div>

        {/* Right — interactive pricing cards */}
        <div className="flex shrink-0 flex-col gap-3 lg:w-[320px]">
          <div className="text-foreground/40 mb-1 text-xs tracking-wider uppercase">Try it</div>
          {plans.map((plan) => {
            const isActive = activePlan === plan.id;
            return (
              <div
                key={plan.id}
                className={cn(
                  "border-foreground/[0.08] flex flex-col gap-3 border p-5 transition-all",
                  isActive && "border-foreground/[0.2] bg-foreground/[0.02]",
                )}
              >
                <div className="flex items-baseline justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground/90 text-base font-semibold">{plan.name}</span>
                    {isActive && (
                      <span className="bg-foreground/[0.06] text-foreground/50 px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-foreground/80 text-lg font-semibold">{plan.price}</span>
                    <span className="text-foreground/40 text-xs">{plan.interval}</span>
                  </div>
                </div>

                <ul className="space-y-1.5">
                  {plan.features.map((feat) => (
                    <li key={feat} className="text-foreground/50 flex items-center gap-2 text-xs">
                      <Check className="text-foreground/30 size-3 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  disabled={isActive || transitioning}
                  onClick={() => handleSubscribe(plan.id)}
                  className={cn(
                    "mt-1 flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "border-foreground/[0.06] text-foreground/30 cursor-default border"
                      : "bg-foreground text-background hover:opacity-90",
                    transitioning && !isActive && "opacity-70",
                  )}
                >
                  {transitioning && !isActive ? (
                    <>
                      <Loader2 className="size-3 animate-spin" />
                      Redirecting to checkout...
                    </>
                  ) : isActive ? (
                    "Current plan"
                  ) : plan.id === "pro" ? (
                    "Upgrade to Pro"
                  ) : (
                    "Downgrade to Free"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </SectionContainer>
  );
}
