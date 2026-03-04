# PayKit — Project Idea

> Open-source payments orchestration for modern SaaS.

PayKit is a TypeScript-first payments orchestration framework that unifies
multiple payment providers behind a single, extensible API.

## Who It's For

SaaS companies that:

- Operate in multiple regions
- Use multiple payment providers
- Need subscriptions without provider lock-in
- Want their database to be the source of truth
- Want to add/swap providers without rewriting billing code

## Core Philosophy

**Orchestration, not processing.** PayKit does not move money. It
coordinates, normalizes, and abstracts across providers.

**Your database is the source of truth.** External providers are execution
engines. Webhooks update internal state. Business logic reads from your DB.

**Provider-agnostic design.** Business code never depends on
`stripeSubscriptionId` or `paypalPlanId`. Provider details are namespaced.
Core model belongs to PayKit.

**Leverage, don't reimplement.** Each provider already has a battle-tested
subscriptions engine, checkout flow, and webhook system. PayKit uses them —
it doesn't rebuild them. The value is in the unified layer on top.

## Architecture

```
Your App -> PayKit Core -> Provider Adapter -> External Provider
```

**PayKit is an orchestration layer, not a billing engine.** Provider adapters
delegate to each provider's native subscription/checkout/webhook systems.
PayKit normalizes the interface and syncs state back to your database.

This means:
- Subscriptions use each provider's native engine (Stripe Billing, PayPal
  subscriptions, etc.) behind a unified API
- Webhook events are normalized — `invoice.payment_failed` (Stripe) and
  `BILLING.SUBSCRIPTION.PAYMENT.FAILED` (PayPal) both become
  `paykit.payment.failed` with a consistent shape
- Switching providers for new customers is config, not a rewrite
- Provider adapters are thin (~5-10 methods), making new integrations easy
- Your DB always reflects the current state — providers are the execution
  layer, not the source of truth

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
- Subscriptions — manage lifecycle through provider-native engines, one API
- Checkout — one-time payments, hosted checkout, payment links
- Webhook normalization — verify, normalize, sync to DB, emit typed events
- Payment method management (attach, detach, set default)
- DB adapters (Prisma, Drizzle) — your database owns the state
- Plugin system for custom providers and extensions
- End-to-end type safety with Zod validation

## Business

**OSS core** (free): orchestration, adapters, subscriptions, DB integration.

**Paid extensions** (future): hosted webhook reliability, unified control
plane (dashboard, analytics, reconciliation), merchant of record (tax,
compliance).

## Guiding Principles

- Clarity over cleverness
- Correctness over speed
- Orchestrate, don't reimplement
- No provider leakage
- Type safety first
