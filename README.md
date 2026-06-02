<br>

<p align="center">
  <a name="readme-top"></a>
  <a href="https://paykit.sh">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="apps/web/public/brand/logo-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="apps/web/public/brand/logo-light.svg">
      <img alt="PayKit" src="apps/web/public/brand/logo-light.svg" height="100">
    </picture>
  </a>
</p>

<h3 align="center">The billing framework for TypeScript</h3>

<p align="center">
  Define plans in code. Gate features. Track usage. Webhooks handled for you.
</p>

<p align="center">
  <a href="https://paykit.sh"><strong>Website</strong></a> ·
  <a href="https://paykit.sh/docs"><strong>Docs</strong></a> ·
  <a href="https://discord.gg/nzy9NPpFNU"><strong>Discord</strong></a> ·
  <a href="https://x.com/paykit_sh"><strong>Twitter</strong></a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/paykitjs"><img src="https://img.shields.io/npm/v/paykitjs?style=flat-square&color=333" alt="npm version"></a>
  <a href="https://github.com/getpaykit/paykit/blob/main/LICENSE"><img src="https://img.shields.io/github/license/getpaykit/paykit?style=flat-square&color=333" alt="License"></a>
  <a href="https://www.npmjs.com/package/paykitjs"><img src="https://img.shields.io/npm/dt/paykitjs?style=flat-square&color=333" alt="npm downloads"></a>
</p>

---

## What is PayKit?

PayKit is an embedded billing framework for TypeScript apps. It sits inside your app, uses your database, and gives you a single API to manage products, subscriptions, entitlements, and usage billing without touching provider dashboards.

```ts
import { createPayKit, feature, plan } from "paykitjs";

const messages = feature({ id: "messages", type: "metered" });

const free = plan({
  id: "free",
  group: "base",
  default: true,
  includes: [messages({ limit: 100, reset: "month" })],
});

const pro = plan({
  id: "pro",
  group: "base",
  price: { amount: 19, interval: "month" },
  includes: [messages({ limit: 2_000, reset: "month" })],
});

export const paykit = createPayKit({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  },
  database: process.env.DATABASE_URL!,
  products: [free, pro],
});
```

### Getting started

```bash
npx paykitjs init
```

Or follow the [installation guide](https://paykit.sh/docs/get-started/installation).

### Why PayKit

Billing in the TypeScript ecosystem is either handled through low-level provider SDKs that require a lot of glue code, or through hosted platforms that own your billing data and sit between you and your customers. PayKit takes a different approach: it's an open-source framework that runs inside your app, keeps billing state in your own database, and handles the Stripe lifecycle so you don't have to.

## Contribution

PayKit is free and open source project licensed under the [MIT License](./LICENSE). You are free to do whatever you want with it.

You can help continue its development by:

- [Contribute to the source code](./CONTRIBUTING.md)
- [Suggest new features and report issues](https://github.com/getpaykit/paykit/issues)

## Security

If you discover a security vulnerability within PayKit, please send an email to [security@paykit.sh](mailto:security@paykit.sh).

All reports will be promptly addressed, and you'll be credited accordingly.
