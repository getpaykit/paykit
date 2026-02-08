# PayKit

**Open‑source payments orchestration for modern SaaS.**

PayKit is a TypeScript‑first framework that lets you integrate and operate
multiple payment providers through a single, consistent API — without locking
your business to any processor.

PayKit **orchestrates** payments. It does not process them.

---

## Why PayKit?

Most teams start with a single provider like Stripe.
As soon as you expand internationally, add PayPal, or need regional card
processors, payments become fragile and hard to maintain.

PayKit exists for teams that:

- Use **multiple payment providers**
- Operate in **multiple regions**
- Want **control without lock‑in**
- Care about **correctness and extensibility**

---

## What PayKit Does

- Unified TypeScript API across providers
- Provider adapters (Stripe, PayPal, regional PSPs)
- Card payments with a single form
- Subscriptions (periodic & usage‑based)
- Attach / detach payment methods
- Hosted checkout (self‑hosted, white‑label)
- Internal balance & ledger abstraction
- Webhook normalization
- Plugin & adapter system
- DB‑native (Prisma / Drizzle)
- Next.js‑first developer experience

---

## What PayKit Is Not

- ❌ A payment processor
- ❌ A Stripe replacement
- ❌ A closed SaaS you can’t self‑host

PayKit sits **between your app and payment providers** and gives you a stable,
extensible foundation.

---

## Architecture (High Level)

You own:

- Your database
- Your UI
- Your dashboards
- Your payment relationships

---

## Open Source First

PayKit is open source and designed to be:

- Inspectable
- Extensible
- Self‑hostable
- Production‑ready

You can build your own dashboards, workflows, and internal tooling directly on
top of PayKit.

---

## PayKit Cloud (Optional)

For teams that want less operational overhead, PayKit Cloud provides:

- Unified admin dashboard across providers
- Reliable webhook ingestion & retries
- Analytics & reconciliation
- Tax & accounting integrations
- Enterprise support & SLAs

Using PayKit Cloud is optional.
The core framework will remain open source.

---

## Status

🚧 **Early development**

Initial focus:

- Stripe adapter
- PayPal adapter
- Core orchestration API
- Plugin system
- Prisma integration

APIs may change.

---

## Inspiration

PayKit is inspired by the developer‑first, adapter‑based approach of the [better‑auth](https://github.com/better-auth/better-auth) project.

---

## License

MIT
