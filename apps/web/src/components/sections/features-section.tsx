import { Blocks, Cable, Database, Gauge, ShieldCheck, Webhook } from "lucide-react";

import { Section, SectionContent } from "@/components/layout/section";

const features = [
  {
    icon: <Gauge className="size-5" />,
    title: "Usage billing",
    description: "Metered features with check() and report(). Zero network latency.",
  },
  {
    icon: <Webhook className="size-5" />,
    title: "Webhooks handled",
    description: "Verified, deduplicated, synced to your database automatically.",
  },
  {
    icon: <Cable className="size-5" />,
    title: "Stripe built in",
    description: "Subscriptions, webhooks, portal, and product sync without adapter setup.",
  },
  {
    icon: <Blocks className="size-5" />,
    title: "Plugins",
    description: "Extend PayKit with dashboard, analytics, or build your own plugin.",
  },
  {
    icon: <Database className="size-5" />,
    title: "Your database",
    description: "Billing state in your Postgres, low latency, joinable with your tables.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Type-safe",
    description: "Plan IDs, feature IDs, events. All inferred from your schema.",
  },
];

export function FeaturesSection() {
  return (
    <Section>
      <SectionContent>
        <div className="mb-6 max-w-lg space-y-2 lg:mb-10">
          <h2 className="text-foreground/90 text-xl font-semibold tracking-tight sm:text-2xl">
            Features
          </h2>
          <p className="text-foreground/45 text-sm leading-relaxed sm:text-base">
            Everything you need to add billing to your app. Nothing you don't.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group border-foreground/[0.08] rounded-[10px] border p-[4px] transition-colors hover:border-foreground/[0.1]"
            >
              <div className="flex h-full flex-col gap-3 rounded-md border border-foreground/[0.06] p-5 transition-colors group-hover:border-foreground/[0.08] group-hover:bg-foreground/[0.01]">
                <span className="text-foreground/40 transition-colors group-hover:text-foreground/50">
                  {feature.icon}
                </span>
                <div className="space-y-1">
                  <h3 className="text-foreground/90 text-sm font-semibold">{feature.title}</h3>
                  <p className="text-foreground/45 text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionContent>
    </Section>
  );
}
