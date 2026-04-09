export { createPayKit } from "./core/create-paykit";

export type { PayKitLoggingOptions, PayKitOptions, PayKitTestingOptions } from "./types/options";
export type {
  CustomerEntitlement,
  CustomerSubscription,
  CustomerWithDetails,
  ListCustomersResult,
  PayKitAdvanceTestClockInput,
  PayKitClientAdvanceTestClockInput,
  PayKitClientCustomerPortalInput,
  PayKitClientGetTestClockInput,
  PayKitClientSubscribeInput,
  PayKitGetTestClockInput,
  PayKitInstance,
  PayKitCheckInput,
  PayKitCustomerPortalInput,
  PayKitReportInput,
  PayKitSubscribeInput,
  PayKitSubscribeResult,
} from "./types/instance";
export type {
  CheckResult,
  EntitlementBalance,
  ReportResult,
} from "./entitlement/entitlement.service";
export type {
  ProviderCustomer,
  ProviderCustomerMap,
  PayKitProvider,
  ProviderTestClock,
  StripeProviderConfig,
  StripeProviderOptions,
} from "./providers/provider";
export type {
  Customer,
  StoredFeature,
  StoredInvoice,
  StoredProduct,
  StoredProductFeature,
  StoredSubscription,
} from "./types/models";
export type {
  FeatureType,
  MeteredFeatureConfig,
  MeteredResetInterval,
  NormalizedPlan,
  NormalizedPlanFeature,
  NormalizedSchema,
  PayKitFeature,
  PayKitFeatureDefinition,
  PayKitFeatureInclude,
  PayKitPlan,
  PayKitPlanConfig,
  PayKitPlansModule,
  PlanPrice,
  PriceInterval,
} from "./types/schema";
export type {
  NormalizedInvoice,
  NormalizedPayment,
  NormalizedPaymentMethod,
  NormalizedSubscription,
  NormalizedWebhookEvent,
  NormalizedWebhookEventMap,
  NormalizedWebhookEventName,
  PayKitEventHandlers,
  PayKitEventMap,
  PayKitEventName,
  WebhookApplyAction,
} from "./types/events";

export type { PayKitPlugin } from "./types/plugin";
export type { DrizzleAdapterInstance } from "./database/index";

export { PayKitError, PAYKIT_ERROR_CODES } from "./core/errors";
export type { PayKitErrorCode } from "./core/errors";
export { defineErrorCodes } from "./core/error-codes";
export type { RawError } from "./core/error-codes";
export { feature, plan } from "./types/schema";
export { createPayKitEndpoint, definePayKitMethod, returnUrl } from "./api/define-route";
