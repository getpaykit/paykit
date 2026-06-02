import {
  CalendarCheck,
  CalendarX,
  CreditCard,
  Database,
  ExternalLink,
  Link2,
  RefreshCw,
  Shield,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Webhook,
} from "lucide-react";
import type { ReactNode } from "react";

export type SnippetKey = "subscribe" | "check" | "report" | "portal" | "downgrade" | "resubscribe";

export type StepIcon =
  | "user"
  | "credit-card"
  | "webhook"
  | "database"
  | "sparkles"
  | "link"
  | "external-link"
  | "calendar-x"
  | "calendar-check"
  | "shield"
  | "shield-alert"
  | "refresh";

export type FlowEntry =
  | { type: "code"; snippet: SnippetKey }
  | { type: "step"; icon: StepIcon; label: string; success?: boolean }
  | { type: "pending"; label: string };

export type FlowCard = {
  id: string;
  trigger: string;
  entries: FlowEntry[];
};

let cardId = 0;
export function nextCardId() {
  return `card-${++cardId}`;
}

export const stepIcons: Record<StepIcon, ReactNode> = {
  user: <UserCheck className="size-3 shrink-0" />,
  "credit-card": <CreditCard className="size-3 shrink-0" />,
  webhook: <Webhook className="size-3 shrink-0" />,
  database: <Database className="size-3 shrink-0" />,
  link: <Link2 className="size-3 shrink-0" />,
  "external-link": <ExternalLink className="size-3 shrink-0" />,
  "calendar-x": <CalendarX className="size-3 shrink-0" />,
  "calendar-check": <CalendarCheck className="size-3 shrink-0" />,
  sparkles: <Sparkles className="size-3 shrink-0" />,
  shield: <Shield className="size-3 shrink-0" />,
  "shield-alert": <ShieldAlert className="size-3 shrink-0" />,
  refresh: <RefreshCw className="size-3 shrink-0" />,
};

// Scripted replies for auto-play
export const scriptedReplies = [
  "Define your plans in code, connect Stripe, and call subscribe(). PayKit handles checkout, webhooks, and state sync automatically.",
  "Yes! Define metered features, then use check() and report() to enforce them.",
];

// Interactive replies for user-typed messages
export const interactiveReplies = [
  "PayKit writes all billing state to your Postgres. No more Stripe API calls to check subscription status.",
  "Fun fact: upgrades apply immediately, downgrades wait until end of cycle. All automatic.",
  "Your plans are type-safe. Typo a plan ID and TypeScript catches it at build time.",
  "The dashboard mounts at /paykit in your app. No separate service to deploy.",
  "Webhooks are verified and deduplicated in the same DB transaction. No double charges.",
  "Stripe details stay inside PayKit. Your app keeps using plans, customers, and features.",
  "Every entitlement check is a single function call. No complex permission logic needed.",
  "PayKit runs inside your app. It's a library, not a platform. One npm install and you're set.",
];

export const FREE_LIMIT = 2;
export const PRO_LIMIT = 10;
export const INITIAL_USED = 0;
