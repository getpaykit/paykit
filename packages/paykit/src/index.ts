export { createPayKit } from "./core/create-paykit";

export type { PayKitOptions, ProviderId } from "./types/options";
export type { PayKitInstance, ScopedPayKitInstance, CustomerIdentity } from "./types/instance";
export type { PayKitProvider } from "./providers/provider";
export type { Customer, Payment, PaymentMethod, Refund } from "./types/models";
export type {
  AnyNormalizedWebhookEvent,
  AnyPayKitEvent,
  NormalizedWebhookEvent,
  NormalizedWebhookEventMap,
  NormalizedWebhookEventName,
  PayKitCatchAllEvent,
  PayKitCatchAllEventHandler,
  PayKitEvent,
  PayKitEventError,
  PayKitEventHandlers,
  PayKitEventMap,
  PayKitEventName,
  PayKitEventPayload,
  PayKitNamedEventHandler,
  WebhookApplyAction,
} from "./types/events";

export { defineProvider } from "./providers/provider";
export { PayKitError } from "./core/errors";
