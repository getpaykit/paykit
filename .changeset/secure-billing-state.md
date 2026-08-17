---
"paykitjs": patch
---

Harden browser return URLs and customer mutations, reject test clocks with live Stripe keys, make customer deletion and billing upserts race-safe, and enforce webhook claim ownership. The database migration deduplicates existing Stripe billing rows before adding unique indexes.
