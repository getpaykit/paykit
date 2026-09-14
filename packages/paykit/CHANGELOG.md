# paykitjs

## 0.1.7

### Patch Changes

- [`75557aa`](https://github.com/getpaykit/paykit/commit/75557aaba1596a251b6ec25e019813af83e70a67) Thanks [@maxktz](https://github.com/maxktz)! - Harden browser return URLs and customer mutations, reject test clocks with live Stripe keys, make customer deletion and billing upserts race-safe, and enforce webhook claim ownership. The database migration deduplicates existing Stripe billing rows before adding unique indexes.

## 0.1.6

### Minor Changes

- Add Stripe currency support for USD and EUR
