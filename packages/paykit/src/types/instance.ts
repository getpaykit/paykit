export type {
  CustomerEntitlement,
  CustomerSubscription,
  CustomerWithDetails,
  ListCustomersResult,
} from "../customer/customer.types";
import type { PayKitMethod as DefinedPayKitMethod } from "../api/define-route";
import type {
  methods as registeredMethods,
  testingMethods as registeredTestingMethods,
} from "../api/methods";
import type { PayKitContext } from "../core/context";
import type { PayKitOptions } from "./options";
import type { FeatureIdFromProducts, PlanIdFromProducts } from "./schema";

type RegisteredMethods = typeof registeredMethods;
type RegisteredMethodKey = keyof RegisteredMethods;
type RegisteredTestingMethodKey = keyof typeof registeredTestingMethods;

type PlanIdFromOptions<TOptions extends PayKitOptions> = [
  PlanIdFromProducts<TOptions["products"]>,
] extends [never]
  ? string
  : PlanIdFromProducts<TOptions["products"]>;

type FeatureIdFromOptions<TOptions extends PayKitOptions> = [
  FeatureIdFromProducts<TOptions["products"]>,
] extends [never]
  ? string
  : FeatureIdFromProducts<TOptions["products"]>;

type InferMethodInput<TMethod> =
  TMethod extends DefinedPayKitMethod<infer TInput, unknown> ? TInput : never;

type InferMethodResult<TMethod> =
  TMethod extends DefinedPayKitMethod<infer _TInput, infer TResult> ? TResult : never;

type InferMethodPath<TMethod> = TMethod extends {
  endpoint: { path: infer TPath extends string };
}
  ? TPath
  : never;

type OmitCustomerId<TInput> = TInput extends undefined
  ? undefined
  : TInput extends object
    ? Omit<TInput, "customerId">
    : TInput;

type RefineServerMethodInput<
  TOptions extends PayKitOptions,
  TKey extends RegisteredMethodKey,
  TInput,
> = TKey extends "subscribe"
  ? TInput extends { cancelUrl?: string; forceCheckout?: boolean; successUrl?: string }
    ? TInput & {
        customerId: string;
        planId: PlanIdFromOptions<TOptions>;
        successUrl: string;
      }
    : TInput
  : TKey extends "check" | "report"
    ? TInput extends { featureId: string }
      ? Omit<TInput, "featureId"> & {
          featureId: FeatureIdFromOptions<TOptions>;
        }
      : TInput
    : TInput;

type RefineClientMethodInput<
  TOptions extends PayKitOptions,
  TKey extends RegisteredMethodKey,
  TInput,
> = TKey extends "subscribe"
  ? OmitCustomerId<TInput> extends {
      cancelUrl?: string;
      forceCheckout?: boolean;
      successUrl?: string;
    }
    ? Omit<OmitCustomerId<TInput>, "planId"> & {
        planId: PlanIdFromOptions<TOptions>;
      }
    : OmitCustomerId<TInput>
  : TKey extends "customerPortal"
    ? OmitCustomerId<TInput> extends { returnUrl: string }
      ? Omit<OmitCustomerId<TInput>, "returnUrl"> & { returnUrl?: string }
      : OmitCustomerId<TInput>
    : OmitCustomerId<TInput>;

export type PayKitClientSubscribeInput<TOptions extends PayKitOptions = PayKitOptions> =
  RefineClientMethodInput<TOptions, "subscribe", InferMethodInput<RegisteredMethods["subscribe"]>>;

export type PayKitSubscribeInput<TOptions extends PayKitOptions = PayKitOptions> =
  RefineServerMethodInput<TOptions, "subscribe", InferMethodInput<RegisteredMethods["subscribe"]>>;

export type PayKitSubscribeResult = InferMethodResult<RegisteredMethods["subscribe"]>;

export type PayKitCustomerInput = InferMethodInput<RegisteredMethods["upsertCustomer"]>;

export type PayKitClientCustomerPortalInput = RefineClientMethodInput<
  PayKitOptions,
  "customerPortal",
  InferMethodInput<RegisteredMethods["customerPortal"]>
>;

export type PayKitCustomerPortalInput = RefineServerMethodInput<
  PayKitOptions,
  "customerPortal",
  InferMethodInput<RegisteredMethods["customerPortal"]>
>;

export type PayKitListCustomersInput = InferMethodInput<RegisteredMethods["listCustomers"]>;

export type PayKitClientGetTestClockInput = RefineClientMethodInput<
  PayKitOptions,
  "getTestClock",
  InferMethodInput<RegisteredMethods["getTestClock"]>
>;

export type PayKitGetTestClockInput = RefineServerMethodInput<
  PayKitOptions,
  "getTestClock",
  InferMethodInput<RegisteredMethods["getTestClock"]>
>;

export type PayKitClientAdvanceTestClockInput = RefineClientMethodInput<
  PayKitOptions,
  "advanceTestClock",
  InferMethodInput<RegisteredMethods["advanceTestClock"]>
>;

export type PayKitAdvanceTestClockInput = RefineServerMethodInput<
  PayKitOptions,
  "advanceTestClock",
  InferMethodInput<RegisteredMethods["advanceTestClock"]>
>;

export type PayKitCheckInput<TOptions extends PayKitOptions = PayKitOptions> =
  RefineServerMethodInput<TOptions, "check", InferMethodInput<RegisteredMethods["check"]>>;

export type PayKitReportInput<TOptions extends PayKitOptions = PayKitOptions> =
  RefineServerMethodInput<TOptions, "report", InferMethodInput<RegisteredMethods["report"]>>;

export type PayKitWebhookInput = InferMethodInput<RegisteredMethods["handleWebhook"]>;

export declare const payKitClientApiBrand: unique symbol;

type PayKitMethod<TInput, TResult> = (input: TInput) => Promise<TResult>;

type PayKitClientMethod<TPath extends string, TInput, TResult> = ((
  input: TInput,
) => Promise<TResult>) & {
  path: TPath;
  options: unknown;
};

type TestingEnabled<TOptions extends PayKitOptions> = TOptions["testing"] extends { enabled: true }
  ? true
  : false;

type TestingAvailable<TOptions extends PayKitOptions> = TestingEnabled<TOptions>;

type EnabledMethodKeys<TOptions extends PayKitOptions> =
  TestingAvailable<TOptions> extends true
    ? RegisteredMethodKey
    : Exclude<RegisteredMethodKey, RegisteredTestingMethodKey>;

type ClientMethodKeys = {
  [K in RegisteredMethodKey]-?: RegisteredMethods[K] extends { client: true } ? K : never;
}[RegisteredMethodKey];

type EnabledClientMethodKeys<TOptions extends PayKitOptions> =
  TestingAvailable<TOptions> extends true
    ? ClientMethodKeys
    : Exclude<ClientMethodKeys, RegisteredTestingMethodKey>;

type GeneratePayKitAPI<TOptions extends PayKitOptions> = {
  [K in EnabledMethodKeys<TOptions>]: PayKitMethod<
    RefineServerMethodInput<TOptions, K, InferMethodInput<RegisteredMethods[K]>>,
    InferMethodResult<RegisteredMethods[K]>
  >;
};

type GeneratePayKitClientAPI<TOptions extends PayKitOptions> = {
  [K in EnabledClientMethodKeys<TOptions>]: PayKitClientMethod<
    InferMethodPath<RegisteredMethods[K]>,
    RefineClientMethodInput<TOptions, K, InferMethodInput<RegisteredMethods[K]>>,
    InferMethodResult<RegisteredMethods[K]>
  >;
};

export interface PayKitClientApiCarrier<TClientApi> {
  readonly [payKitClientApiBrand]?: TClientApi;
}

export type PayKitClientAPI<TOptions extends PayKitOptions = PayKitOptions> =
  GeneratePayKitClientAPI<TOptions>;

export type PayKitAPI<TOptions extends PayKitOptions = PayKitOptions> = GeneratePayKitAPI<TOptions>;

export type PayKitInstance<TOptions extends PayKitOptions = PayKitOptions> = PayKitAPI<TOptions> &
  PayKitClientApiCarrier<PayKitClientAPI<TOptions>> & {
    options: TOptions;
    handler: (request: Request) => Promise<Response>;
    $context: Promise<PayKitContext>;
    $infer: {
      planId: PlanIdFromOptions<TOptions>;
      featureId: FeatureIdFromOptions<TOptions>;
    };
  };
