---
name: paykit-architecture
description: not use automatically
---

# PayKit Architecture

Use this before architectural, API design, provider integration, billing
lifecycle, database model, or product-scope decisions.

Read `ob/spec.md` and relevant package code before making recommendations.

Favor embedded, type-safe billing primitives that keep provider details isolated.
PayKit should run inside the user's app, use their database, and expose APIs that
make plans, subscriptions, entitlements, and usage billing feel like normal
application code.
