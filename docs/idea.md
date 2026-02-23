# PayKit — Project Idea

> Open-source payments orchestration for modern SaaS.

PayKit is a TypeScript-first payments orchestration framework that unifies
multiple payment providers behind a single, extensible API.

## Who It's For

SaaS companies that:

- Operate in multiple regions
- Use multiple payment providers
- Need subscriptions + usage billing
- Want control over their data
- Want to avoid vendor lock-in

## Core Philosophy

**Orchestration, not processing.** PayKit does not move money. It
coordinates, normalizes, and abstracts across providers.

**Your database is the source of truth.** External providers are execution
engines. Webhooks update internal state. Business logic reads from your DB.

**Provider-agnostic design.** Business code never depends on
`stripeSubscriptionId` or `paypalPlanId`. Provider details are namespaced.
Core model belongs to PayKit.

## Architecture

```
Your App -> PayKit Core -> Provider Adapter -> External Provider
```

Webhooks flow back through the same layers in reverse. Subscription
lifecycle is state-machine driven with explicit, persisted, event-driven
transitions.

### Packages

```
packages/
  paykit/     Core orchestration library
  stripe/     Stripe provider adapter
  paypal/     PayPal provider adapter
  prisma/     Prisma database adapter
  drizzle/    Drizzle database adapter
  cli/        CLI for migrations and scaffolding
```

## Features

- Unified TypeScript API across providers
- Subscriptions (recurring, usage-based, hybrid, trials, proration)
- Payment method management (attach, detach, set default)
- Webhook normalization (verify, normalize, update DB, emit events)
- Optional internal balance / wallet system
- DB adapters (Prisma, Drizzle)
- Plugin & adapter system for custom providers

## Business

**OSS core** (free): orchestration, adapters, subscriptions, DB integration.

**Paid extensions** (future): hosted webhook reliability, unified control
plane (dashboard, analytics, reconciliation), merchant of record (tax,
compliance).

## Guiding Principles

- Clarity over cleverness
- Correctness over speed
- Explicit state transitions
- No provider leakage
- Type safety first
