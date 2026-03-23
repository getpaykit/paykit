export { createPayKit } from "./core/create-paykit";

export type { PayKitOptions } from "./types/options";
export type { CustomerIdentity, PayKitInstance } from "./types/instance";
export type { PayKitProvider } from "./providers/provider";
export type { Customer, StoredProduct } from "./types/models";
export type { PriceInterval, Product, ProductPrice } from "./types/product";
export type {
  NormalizedPayment,
  NormalizedPaymentMethod,
  NormalizedWebhookEvent,
  NormalizedWebhookEventMap,
  NormalizedWebhookEventName,
  PayKitEventError,
  PayKitEventHandlers,
  PayKitEventMap,
  PayKitEventName,
  WebhookApplyAction,
} from "./types/events";

export { defineProvider } from "./providers/provider";
export { PayKitError } from "./core/errors";
export { product } from "./types/product";
