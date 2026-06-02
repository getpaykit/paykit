"use client";

import {
  Blocks,
  Cable,
  Database,
  Gauge,
  Monitor,
  Package,
  ShieldCheck,
  Terminal,
  Webhook,
} from "lucide-react";
import type { ReactNode } from "react";

const features: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: <Package className="size-5" />,
    title: "Products in Code",
    description: "Define plans and features as typed primitives.",
  },
  {
    icon: <Webhook className="size-5" />,
    title: "Webhooks Handled",
    description: "Verified, deduplicated, synced to your database automatically.",
  },
  {
    icon: <Gauge className="size-5" />,
    title: "Usage Billing",
    description: "Metered features with check() and report().",
  },
  {
    icon: <Cable className="size-5" />,
    title: "Built For Stripe",
    description: "Stripe subscriptions, webhooks, portal, and product sync built in.",
  },
  {
    icon: <Blocks className="size-5" />,
    title: "Plugin Ecosystem",
    description: "Dashboard, analytics, or build your own plugin.",
  },
  {
    icon: <Database className="size-5" />,
    title: "Local Billing State",
    description: "Billing state in your Postgres, joinable with your tables.",
  },
  {
    icon: <Terminal className="size-5" />,
    title: "CLI",
    description: "Init, push, and status. Scaffold, migrate, validate.",
  },
  {
    icon: <Monitor className="size-5" />,
    title: "Client SDK",
    description: "Browser-side billing calls with full type inference.",
  },
  {
    icon: <ShieldCheck className="size-5" />,
    title: "Type-safe",
    description: "Plan IDs, feature IDs, events — all inferred from your schema.",
  },
];

export function Features() {
  return (
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
            <div className="flex flex-col gap-1">
              <h3 className="!m-0 text-foreground/90 text-sm font-semibold">{feature.title}</h3>
              <p className="!m-0 text-foreground/45 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
