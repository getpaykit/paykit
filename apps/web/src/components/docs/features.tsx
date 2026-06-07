"use client";

import type { ReactNode } from "react";
import {
  RiBox3Line,
  RiComputerLine,
  RiDatabase2Line,
  RiPlug2Line,
  RiPuzzle2Line,
  RiShieldCheckLine,
  RiSpeedUpLine,
  RiTerminalBoxLine,
  RiWebhookLine,
} from "react-icons/ri";

import { FrameCorners } from "@/components/ui/frame-corners";

const features: { icon: ReactNode; title: string; description: string }[] = [
  {
    icon: <RiBox3Line className="size-5" />,
    title: "Products in Code",
    description: "Define plans and features as typed primitives.",
  },
  {
    icon: <RiWebhookLine className="size-5" />,
    title: "Webhooks Handled",
    description: "Verified, deduplicated, synced to your database automatically.",
  },
  {
    icon: <RiSpeedUpLine className="size-5" />,
    title: "Usage Billing",
    description: "Metered features with check() and report().",
  },
  {
    icon: <RiPlug2Line className="size-5" />,
    title: "Built For Stripe",
    description: "Stripe subscriptions, webhooks, portal, and product sync built in.",
  },
  {
    icon: <RiPuzzle2Line className="size-5" />,
    title: "Plugin Ecosystem",
    description: "Dashboard, analytics, or build your own plugin.",
  },
  {
    icon: <RiDatabase2Line className="size-5" />,
    title: "Local Billing State",
    description: "Billing state in your Postgres, joinable with your tables.",
  },
  {
    icon: <RiTerminalBoxLine className="size-5" />,
    title: "CLI",
    description: "Init, push, and status. Scaffold, migrate, validate.",
  },
  {
    icon: <RiComputerLine className="size-5" />,
    title: "Client SDK",
    description: "Browser-side billing calls with full type inference.",
  },
  {
    icon: <RiShieldCheckLine className="size-5" />,
    title: "Type-safe",
    description: "Plan IDs, feature IDs, events — all inferred from your schema.",
  },
];

export function Features() {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((feature) => (
        <div key={feature.title} className="relative h-full">
          <FrameCorners radius="xs" />
          <div className="group flex h-full flex-col gap-3 rounded-xs border border-border p-5 transition-colors hover:border-foreground/[0.08] hover:bg-foreground/[0.01]">
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
