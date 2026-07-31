import { APIError } from "better-call/error";

import { defineErrorCodes, type RawError } from "./error-codes";

export const PAYKIT_ERROR_CODES = defineErrorCodes({
  CUSTOMER_NOT_FOUND: "Customer not found",
  CUSTOMER_CREATE_FAILED: "Failed to create customer",
  CUSTOMER_UPDATE_FAILED: "Failed to update customer",

  PLAN_NOT_FOUND: "Plan not found",
  PLAN_NOT_SYNCED: "Plan is not synced with provider",
  PLAN_SYNC_FAILED: "Failed to sync plan",

  SUBSCRIPTION_CREATE_FAILED: "Failed to create subscription",
  SUBSCRIPTION_NOT_FOUND: "Subscription not found",

  INVOICE_UPSERT_FAILED: "Failed to upsert invoice",

  FEATURE_UPSERT_FAILED: "Failed to upsert feature",

  PROVIDER_REQUIRED: "A provider is required",
  PROVIDER_INVALID_CONFIG: "Provider config is invalid",
  PROVIDER_CUSTOMER_NOT_FOUND: "Customer not found in provider",
  PROVIDER_SESSION_INVALID: "Provider session did not include a URL",
  PROVIDER_SIGNATURE_MISSING: "Missing provider webhook signature",
  PROVIDER_SUBSCRIPTION_MISSING_ITEMS: "Provider subscription did not include any items",
  PROVIDER_SUBSCRIPTION_MISSING_PERIOD: "Provider subscription did not include period end",
  PROVIDER_SUBSCRIPTION_ITEM_AMBIGUOUS: "Could not determine which subscription item to update",
  PROVIDER_SUBSCRIPTION_ITEM_REMOVAL_REJECTED: "Provider rejected removing this subscription item",
  PROVIDER_PRICE_REQUIRED: "A provider price ID is required",
  PROVIDER_TEST_KEY_REQUIRED: "Testing mode requires provider test credentials",
  PROVIDER_WEBHOOK_INVALID: "Provider webhook payload is invalid",
  PROVIDER_OPERATION_UNSUPPORTED: "The configured provider does not support this operation",

  COMBINED_SUBSCRIBE_DUPLICATE_PLAN: "The same plan was listed more than once",
  COMBINED_SUBSCRIBE_DUPLICATE_GROUP: "Two or more plans belong to the same group",
  COMBINED_SUBSCRIBE_REQUIRES_PAID_PLANS: "Combined checkout requires all plans to be paid plans",
  COMBINED_SUBSCRIBE_EXISTING_SUBSCRIPTION:
    "Customer already has an active subscription for one of these plans",

  ADDON_ALREADY_ACTIVE: "Customer already has an active subscription for this plan",
  ADDON_NOT_ACTIVE: "Customer does not have an active subscription for this plan",
  ADDON_ANCHOR_NOT_FOUND:
    "Customer has no active provider-backed subscription to attach an add-on to",
  ADDON_ANCHOR_AMBIGUOUS:
    "Customer has more than one active provider subscription; specify targetSubscriptionId",

  USAGE_NOT_METERED_FOR_CUSTOMER:
    "Customer has no active subscription for a Stripe-metered plan on this feature",

  IDENTIFY_REQUIRED: "identify must be configured to use HTTP API routes",
  CUSTOMER_ID_MISMATCH: "customerId does not match authenticated user",
  CUSTOMER_ID_REQUIRED: "No customerId provided and no identify configured",
  SUCCESS_URL_REQUIRED:
    "A successUrl is required when subscribe is called without a request context",
  TRUSTED_ORIGIN_INVALID: "Resolved origin is not in trustedOrigins",
  BASEPATH_INVALID: "basePath must start with a leading slash",
  TESTING_NOT_ENABLED: "Testing mode is not enabled",
  TEST_CLOCK_NOT_FOUND: "Customer does not have a test clock",
});

export type PayKitErrorCode = keyof typeof PAYKIT_ERROR_CODES;

type APIErrorStatus = ConstructorParameters<typeof APIError>[0];

export class PayKitError extends APIError {
  code: string;

  constructor(status: APIErrorStatus, error: RawError, message?: string) {
    super(status, {
      message: message ?? error.message,
      code: error.code,
    });
    this.code = error.code;
    this.name = "PayKitError";
  }

  static from(status: APIErrorStatus, error: RawError, message?: string) {
    return new PayKitError(status, error, message);
  }
}
