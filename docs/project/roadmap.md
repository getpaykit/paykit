# Roadmap

## Phase 0 — Foundation (current)

- [x] Monorepo setup (pnpm, Turbo, Biome, TypeScript)
- [x] Project vision & architecture docs
- [ ] CLAUDE.md + AGENTS.md
- [ ] API design document
- [ ] Database schema design
- [ ] Provider adapter interface design

## Phase 1 — Core + Stripe

- [ ] `packages/paykit` — core orchestration library
  - [ ] Customer CRUD
  - [ ] Subscription lifecycle (create, update, cancel, pause/resume)
  - [ ] Payment method management
  - [ ] Webhook handler & event system
  - [ ] Database adapter interface
- [ ] `packages/stripe` — Stripe provider adapter
  - [ ] Customer sync
  - [ ] Subscription management
  - [ ] Payment method handling
  - [ ] Webhook verification & normalization
- [ ] `packages/prisma` — Prisma database adapter
  - [ ] Schema generation
  - [ ] Migration support
- [ ] Integration tests (Stripe test mode)

## Phase 2 — PayPal + Usage Billing

- [ ] `packages/paypal` — PayPal provider adapter
- [ ] Usage metering (report, aggregate)
- [ ] Hybrid subscriptions (recurring + usage)
- [ ] `packages/drizzle` — Drizzle database adapter
- [ ] Multi-provider test suite

## Phase 3 — DX & Ecosystem

- [ ] `packages/cli` — CLI for migrations, scaffolding
- [ ] Internal balance / wallet system
- [ ] Example project (Next.js + Stripe + Prisma)
- [ ] Documentation website
- [ ] npm publish pipeline

## Phase 4 — Production Hardening

- [ ] Idempotency guarantees
- [ ] Webhook retry & deduplication
- [ ] State machine validation & error recovery
- [ ] Audit logging
- [ ] Provider failover / routing

## Future

- Regional PSP adapters
- Hosted checkout (self-hosted, white-label)
- PayKit Cloud (dashboard, analytics, webhook reliability)
- Merchant of Record (tax, compliance)
