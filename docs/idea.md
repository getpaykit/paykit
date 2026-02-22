# Paykit – Project Vision & Architecture

> Open-source payments orchestration for modern SaaS.

---

# 1. Vision

Paykit is a TypeScript-first payments orchestration framework that unifies
multiple payment providers behind a single, extensible API.

It is designed for SaaS companies that:
- Operate in multiple regions
- Use multiple payment providers
- Need subscriptions + usage billing
- Want control over their data
- Want to avoid vendor lock-in

Paykit does **not** process payments.

Paykit orchestrates them.

---

# 2. Problem Statement

Modern SaaS companies quickly outgrow single-provider setups.

Common pain points:

- Stripe + PayPal + regional PSPs
- Different SDKs and inconsistent APIs
- Webhook chaos
- Provider-specific lifecycle states
- Subscriptions implemented differently per provider
- Switching providers requires major rewrites
- Internal balance systems glued onto external billing
- No unified control plane

Most teams:
- Rebuild payment abstraction internally
- Scatter logic across codebase
- Accumulate edge-case hacks
- Fear touching billing code

There is no:
- TypeScript-first orchestration framework
- Open-source, extensible abstraction layer
- Clean integration into existing DB models
- Developer-controlled architecture

Paykit exists to solve this.

---

# 3. Core Philosophy

## 3.1 Orchestration, Not Processing

Paykit:
- Does not move money
- Does not compete with Stripe/Adyen/etc
- Does not require vendor migration

It:
- Coordinates
- Normalizes
- Synchronizes
- Abstracts

---

## 3.2 Your Database Is the Source of Truth

Unlike many SDK wrappers:

- Paykit maintains normalized internal models
- External providers are execution engines
- Webhooks update internal state
- Business logic reads from your database

This ensures:
- Deterministic behavior
- Switchability
- Auditable state
- Ledger safety

---

## 3.3 Provider-Agnostic Design

Business code should never depend on:

- `stripeSubscriptionId`
- `paypalPlanId`
- Provider-specific enums

Instead:

```ts
subscription.provider.externalId
subscription.status
subscription.currentPeriodEnd
```

Provider details are namespaced.

Core model belongs to Paykit.

---

# 4. Target Audience

Paykit is for:

- Multi-region SaaS
- Marketplaces
- Platforms expanding internationally
- Teams integrating multiple PSPs
- Companies wanting failover or routing

Not for:

- Simple Stripe-only startups
- No-code tools
- Hobby projects

---

# 5. Core Features (OSS)

## 5.1 Unified TypeScript API

Example:

```ts
const subscription = await paykit.subscriptions.create({
  customerId: "cus_123",
  items: [
    { priceId: "price_pro_monthly" }
  ],
  trialPeriodDays: 14
});
```

---

## 5.2 Subscription Management

Supports:

- Recurring billing
- Usage-based billing
- Hybrid subscriptions
- Trial periods
- Proration
- Pause/resume
- Scheduled cancellation

---

## 5.3 Usage Metering

```ts
await paykit.subscriptions.reportUsage({
  subscriptionItemId: "item_123",
  quantity: 1500
});
```

Supports:
- Sum
- Max
- Last-value aggregation

---

## 5.4 Payment Methods

- Attach
- Detach
- Set default
- Token normalization
- Unified card abstraction

---

## 5.5 Webhook Orchestration

Single handler:

```ts
await paykit.webhooks.handle({
  provider: "stripe",
  rawBody,
  signature
});
```

Internally:
- Verifies signature
- Normalizes event
- Updates DB
- Emits typed internal events

---

## 5.6 Internal Balance System

Optional wallet:

```ts
await paykit.balance.credit({
  customerId: "cus_123",
  amount: 5000,
  currency: "USD"
});
```

Supports:
- Credit
- Debit
- Fallback-to-balance billing
- Manual adjustments

---

## 5.7 DB Integration

Adapters for:
- Prisma
- Drizzle
- Raw SQL

Your schema is extendable.
Paykit does not own your data.

---

## 5.8 Plugin & Adapter System

Provider interface:

```ts
interface SubscriptionProvider {
  createSubscription(...)
  updateSubscription(...)
  cancelSubscription(...)
  reportUsage(...)
}
```

Allows:
- Stripe adapter
- PayPal adapter
- Regional PSP adapters
- Custom internal provider

---

# 6. Architecture

## 6.1 Layered Model

Business Logic

↓

Paykit Core (Orchestration Layer)

↓

Provider Adapter

↓

External Payment Provider

---

## 6.2 State Machine Driven

Subscription states:

- incomplete
- trialing
- active
- past_due
- unpaid
- canceled
- paused

All state transitions:
- Explicit
- Persisted
- Event-driven

---

## 6.3 Provider Normalization

Providers differ in:
- Naming
- Lifecycle
- Edge cases
- Webhook reliability

Paykit translates:

Stripe / PayPal / etc  
→ Normalized internal model  
→ DB state update  
→ Typed event emission  

---

# 7. Differentiation

Paykit is not:

- A thin SDK wrapper
- A Stripe abstraction
- A payment processor
- A hosted checkout SaaS

It is:

- An orchestration framework
- A state management system
- A provider abstraction layer
- A reliability layer

---

# 8. Monetization Strategy (Future)

## 8.1 OSS Core

Free:
- Core orchestration
- Provider adapters
- Subscription logic
- DB integration

---

## 8.2 Paid Extensions

### 1. Hosted Webhook Reliability
- Retry guarantees
- Ordering guarantees
- Event deduplication
- SLA-backed delivery

### 2. Unified Control Plane
- Multi-provider dashboard
- Revenue analytics
- Reconciliation tools
- Audit logs
- Role-based access

### 3. Merchant of Record (Long-Term)
- VAT handling
- Sales tax
- Compliance
- Cross-border support

---

# 9. Business Goals

Short-term:
- OSS adoption
- Real users
- 10–20 companies relying on it

Mid-term:
- $1k MRR milestone
- Sustainable part-time income
- Transition to full-time

Long-term:
- Trusted infrastructure brand
- Multi-provider default orchestration layer
- Optional enterprise expansion

---

# 10. Guiding Principles

- Clarity over cleverness
- Correctness over speed
- Explicit state transitions
- No provider leakage
- No magic hidden behavior
- Type safety first
- DX matters deeply

---

# 11. What Paykit Avoids

- Lock-in
- Proprietary data formats
- Hidden side effects
- Provider-specific APIs leaking upward
- Over-scoping v1

---

# 12. Initial Scope (v1)

- Stripe adapter
- PayPal adapter
- Subscription creation
- Webhook normalization
- Basic usage metering
- Prisma adapter
- Clean README + example project

Everything else is future.

---

# 13. Why This Project Exists

Paykit exists because:

- Multi-provider SaaS is painful
- Payments logic becomes scattered
- Teams rebuild internal abstractions
- Switching providers is expensive
- Reliability is fragile

Paykit extracts those lessons into a reusable framework.

---

# 14. Core Identity

Paykit is:

- Developer-first
- Infrastructure-grade
- Minimalist
- Transparent
- Extensible
- Calm
- Serious

Not hype-driven.
Not VC-forced.
Not growth-hacked.

Built carefully.
Built intentionally.
Built to last.
