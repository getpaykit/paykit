import type { ReactNode } from "react";
import { Children, isValidElement } from "react";
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

import { extractText } from "@/components/docs/react-node-text";
import { FrameCorners } from "@/components/ui/frame-corners";

const featureIcons: Record<string, typeof RiBox3Line> = {
  "Products in Code": RiBox3Line,
  "Webhooks Handled": RiWebhookLine,
  "Usage Billing": RiSpeedUpLine,
  "Built For Stripe": RiPlug2Line,
  "Plugin Ecosystem": RiPuzzle2Line,
  "Local Billing State": RiDatabase2Line,
  CLI: RiTerminalBoxLine,
  "Client SDK": RiComputerLine,
  "Type-safe": RiShieldCheckLine,
};

export function Features({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

/** Renders a feature's Markdown title and description in the card layout. */
export function FeatureCard({ children }: { children: ReactNode }) {
  const blocks = Children.toArray(children);
  const [titleNode, descriptionNode] = blocks;

  if (
    blocks.length !== 2 ||
    !isValidElement<{ children?: ReactNode }>(titleNode) ||
    !isValidElement<{ children?: ReactNode }>(descriptionNode)
  ) {
    throw new Error("FeatureCard needs a Markdown title and description paragraph.");
  }

  const title = extractText(titleNode.props.children).trim().replace(/\s+/g, " ");
  const Icon = featureIcons[title];

  if (!Icon || !extractText(descriptionNode.props.children).trim()) {
    throw new Error(`FeatureCard has an unknown title or empty description: ${title}`);
  }

  return (
    <div className="relative h-full">
      <FrameCorners radius="xs" />
      <div className="group flex h-full flex-col gap-3 rounded-xs border border-border p-5 transition-colors hover:border-foreground/[0.08] hover:bg-foreground/[0.01]">
        <span className="text-foreground/40 transition-colors group-hover:text-foreground/50">
          <Icon className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <h3 className="!m-0 text-foreground/90 text-sm font-semibold">{title}</h3>
          <p className="!m-0 text-foreground/45 text-sm leading-relaxed">
            {descriptionNode.props.children}
          </p>
        </div>
      </div>
    </div>
  );
}
