import { createEndpoint, createMiddleware } from "better-call";
import type { EndpointContext } from "better-call";
import * as z from "zod";

import type { PayKitContext } from "../core/context";
import { PayKitError, PAYKIT_ERROR_CODES } from "../core/errors";
import { getCustomerByIdOrThrow, upsertCustomer } from "../customer/customer.service";
import type { Customer } from "../types/models";

const paykitMiddleware = createMiddleware(async () => {
  return {} as PayKitContext;
});

export const createPayKitEndpoint: ReturnType<
  typeof createEndpoint.create<{ use: [typeof paykitMiddleware] }>
> = createEndpoint.create({
  use: [paykitMiddleware],
});

type BetterCallOptions = Parameters<typeof createPayKitEndpoint>[1];

type OptionalCustomer<TRequireCustomer extends boolean> = TRequireCustomer extends true
  ? { customer: Customer }
  : { customer?: undefined };

export type PayKitMethodContext<
  TInput,
  TRequireCustomer extends boolean = false,
  TParams = Record<string, string> | undefined,
  THeaders = Headers,
  TRequest = Request | undefined,
> = {
  headers: THeaders;
  input: TInput;
  params: TParams;
  paykit: PayKitContext;
  request: TRequest;
} & OptionalCustomer<TRequireCustomer>;

export type PayKitMethod<TServerInput, TResult> = ((
  paykit: PayKitContext,
  input: TServerInput,
  request?: Request,
) => Promise<TResult>) & {
  client?: boolean;
  endpoint?: { options: unknown; path: string } & Record<string, unknown>;
};

type PayKitMethodRouteConfig = Omit<BetterCallOptions, "body" | "method"> & {
  client?: boolean;
  method: NonNullable<BetterCallOptions["method"]>;
  path: string;
  resolveInput?: (ctx: BetterCallEndpointContext) => Promise<unknown> | unknown;
};

export interface PayKitMethodConfig {
  input?: BetterCallOptions extends { body?: infer TBody } ? TBody : never;
  requireCustomer?: boolean;
  route?: PayKitMethodRouteConfig;
  resolveServerCustomerId?: (input: unknown) => string | undefined;
}

type InferSchemaInput<TSchema> = TSchema extends { _output: infer TOutput } ? TOutput : never;

const returnUrlBrand = "__paykitReturnUrl";

export type PayKitReturnUrlSchema = z.ZodURL & { __paykitReturnUrl: true };

type InferMethodInput<TConfig extends PayKitMethodConfig> = TConfig["input"] extends undefined
  ? TConfig["route"] extends { resolveInput: (...args: unknown[]) => infer TResolved }
    ? Awaited<TResolved>
    : undefined
  : InferSchemaInput<NonNullable<TConfig["input"]>>;

type InferRequireCustomer<TConfig extends PayKitMethodConfig> =
  TConfig["requireCustomer"] extends true ? true : false;

type ServerMethodInput<TConfig extends PayKitMethodConfig> =
  InferRequireCustomer<TConfig> extends true
    ? AddCustomerId<InferMethodInput<TConfig>>
    : InferMethodInput<TConfig>;

type AddCustomerId<TInput> = TInput extends undefined
  ? { customerId: string }
  : TInput extends object
    ? TInput & { customerId: string }
    : TInput;

type BetterCallEndpointContext = EndpointContext<
  string,
  NonNullable<BetterCallOptions["method"]>,
  object | undefined,
  undefined,
  [],
  boolean,
  boolean,
  PayKitContext
>;

type InferRouteContext<TConfig extends PayKitMethodConfig> = TConfig["route"] extends {
  path: infer TPath extends string;
  method: infer TMethod extends NonNullable<BetterCallOptions["method"]>;
  requireHeaders?: infer TRequireHeaders extends boolean;
  requireRequest?: infer TRequireRequest extends boolean;
}
  ? EndpointContext<
      TPath,
      TMethod,
      TConfig["input"] extends object ? TConfig["input"] : undefined,
      undefined,
      [],
      TRequireHeaders,
      TRequireRequest,
      PayKitContext
    >
  : EndpointContext<
      never,
      NonNullable<BetterCallOptions["method"]>,
      TConfig["input"] extends object ? TConfig["input"] : undefined,
      undefined,
      [],
      false,
      false,
      PayKitContext
    >;

type InferRoutePath<TConfig extends PayKitMethodConfig> = TConfig["route"] extends {
  path: infer TPath extends string;
}
  ? TPath
  : never;

type InferClientRoute<TConfig extends PayKitMethodConfig> = TConfig["route"] extends {
  client: true;
}
  ? true
  : false;

type InferMethodMeta<TConfig extends PayKitMethodConfig> = [InferRoutePath<TConfig>] extends [never]
  ? {
      client?: boolean;
      endpoint?: { options: unknown; path: string } & Record<string, unknown>;
    }
  : {
      endpoint: { options: unknown; path: InferRoutePath<TConfig> } & Record<string, unknown>;
    } & (InferClientRoute<TConfig> extends true
      ? { client: true }
      : { client?: false | undefined });

export function definePayKitMethod<const TConfig extends PayKitMethodConfig, TResult>(
  config: TConfig,
  handler: (
    ctx: PayKitMethodContext<
      InferMethodInput<TConfig>,
      InferRequireCustomer<TConfig>,
      InferRouteContext<TConfig>["params"],
      InferRouteContext<TConfig>["headers"],
      InferRouteContext<TConfig>["request"]
    >,
  ) => Promise<TResult> | TResult,
): PayKitMethod<ServerMethodInput<TConfig>, TResult> & InferMethodMeta<TConfig> {
  const call = async (
    paykit: PayKitContext,
    input: ServerMethodInput<TConfig>,
    request?: Request,
  ): Promise<TResult> => {
    const normalizedInput = normalizeMethodInput(
      config.input,
      stripCustomerId(input),
      request,
      request?.headers,
      paykit,
    ) as InferMethodInput<TConfig>;
    const customer = config.requireCustomer
      ? await resolveCustomer(
          paykit,
          request,
          config.resolveServerCustomerId?.(input) ?? getInputCustomerId(input),
        )
      : undefined;

    return handler({
      headers: request?.headers ?? new Headers(),
      input: normalizedInput,
      params: {} as InferRouteContext<TConfig>["params"],
      paykit,
      request: request as InferRouteContext<TConfig>["request"],
      ...(customer ? { customer } : {}),
    } as PayKitMethodContext<
      InferMethodInput<TConfig>,
      InferRequireCustomer<TConfig>,
      InferRouteContext<TConfig>["params"],
      InferRouteContext<TConfig>["headers"],
      InferRouteContext<TConfig>["request"]
    >);
  };

  if (config.route) {
    const endpoint = createPayKitEndpoint(
      config.route.path,
      {
        body: createRouteInputSchema(config.input),
        ...config.route,
        client: undefined,
        path: undefined,
        resolveInput: undefined,
      },
      async (ctx) => {
        const routeInput = normalizeMethodInput(
          config.input,
          config.route?.resolveInput
            ? await config.route.resolveInput(ctx as BetterCallEndpointContext)
            : ctx.body,
          ctx.request,
          ctx.headers,
          ctx.context,
        );
        const customer = config.requireCustomer
          ? await resolveCustomer(ctx.context, ctx.request)
          : undefined;

        return handler({
          headers: ctx.headers,
          input: routeInput as InferMethodInput<TConfig>,
          params: ctx.params as InferRouteContext<TConfig>["params"],
          paykit: ctx.context,
          request: ctx.request as InferRouteContext<TConfig>["request"],
          ...(customer ? { customer } : {}),
        } as PayKitMethodContext<
          InferMethodInput<TConfig>,
          InferRequireCustomer<TConfig>,
          InferRouteContext<TConfig>["params"],
          InferRouteContext<TConfig>["headers"],
          InferRouteContext<TConfig>["request"]
        >);
      },
    );

    call.client = config.route.client === true;
    call.endpoint = endpoint as unknown as { options: unknown; path: string } & Record<
      string,
      unknown
    >;
  }

  return call as unknown as PayKitMethod<ServerMethodInput<TConfig>, TResult> &
    InferMethodMeta<TConfig>;
}

export function returnUrl(): PayKitReturnUrlSchema {
  const schema = z.url();
  Object.defineProperty(schema, returnUrlBrand, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
  return schema as PayKitReturnUrlSchema;
}

function getInputCustomerId(input: unknown): string | undefined {
  if (!input || typeof input !== "object") {
    return undefined;
  }

  return "customerId" in input && typeof input.customerId === "string"
    ? input.customerId
    : undefined;
}

function stripCustomerId<TInput>(input: TInput): TInput {
  if (!input || typeof input !== "object" || !("customerId" in input)) {
    return input;
  }

  const { customerId: _customerId, ...rest } = input;
  return rest as TInput;
}

function normalizeMethodInput(
  schema: PayKitMethodConfig["input"],
  input: unknown,
  request?: Request,
  headers?: Headers,
  paykit?: Pick<PayKitContext, "options">,
): unknown {
  if (!(schema instanceof z.ZodObject) || !input || typeof input !== "object") {
    return input;
  }

  const fields = getReturnUrlFields(schema);
  if (fields.length === 0) {
    return input;
  }

  const normalized = { ...(input as Record<string, unknown>) };
  for (const field of fields) {
    const value = normalized[field];

    if (typeof value === "string") {
      normalized[field] = normalizeReturnUrlValue(field, value, request, headers, paykit);
      continue;
    }

    if (value == null && shouldDefaultReturnUrlField(field)) {
      normalized[field] = resolveAbsoluteUrl("/", request, headers, paykit, field);
    }
  }

  return normalized;
}

function createRouteInputSchema(schema: PayKitMethodConfig["input"]) {
  if (!(schema instanceof z.ZodObject)) {
    return schema;
  }

  const shape = schema.shape;
  const overrides: Record<string, z.ZodTypeAny> = {};

  for (const [key, fieldSchema] of Object.entries(shape)) {
    if (!isReturnUrlSchema(fieldSchema)) {
      continue;
    }

    overrides[key] = createRoutedReturnUrlSchema(key, fieldSchema);
  }

  return Object.keys(overrides).length > 0 ? schema.safeExtend(overrides) : schema;
}

function createRoutedReturnUrlSchema(field: string, schema: unknown): z.ZodTypeAny {
  const typedSchema = schema as z.ZodTypeAny;
  if (typedSchema instanceof z.ZodOptional) {
    return createRoutedReturnUrlSchema(field, typedSchema.unwrap()).optional();
  }

  const routedSchema = z.string().refine((value) => isAbsoluteUrl(value) || isAbsolutePath(value), {
    message: "Invalid URL",
  });

  return shouldDefaultReturnUrlField(field) ? routedSchema.optional() : routedSchema;
}

function getReturnUrlFields(schema: z.ZodObject<any>): string[] {
  return (Object.entries(schema.shape) as Array<[string, unknown]>)
    .filter(([, fieldSchema]) => isReturnUrlSchema(fieldSchema))
    .map(([field]) => field);
}

function isReturnUrlSchema(schema: unknown): boolean {
  const typedSchema = schema as z.ZodTypeAny;
  if (typedSchema instanceof z.ZodOptional) {
    return isReturnUrlSchema(typedSchema.unwrap());
  }

  return (typedSchema as Partial<PayKitReturnUrlSchema>)[returnUrlBrand] === true;
}

function normalizeReturnUrlValue(
  field: string,
  value: string,
  request?: Request,
  headers?: Headers,
  paykit?: Pick<PayKitContext, "options">,
): string {
  if (isAbsolutePath(value)) {
    return resolveAbsoluteUrl(value, request, headers, paykit, field);
  }

  return value;
}

function shouldDefaultReturnUrlField(field: string): boolean {
  return field !== "cancelUrl";
}

function resolveAbsoluteUrl(
  value: string,
  request: Request | undefined,
  headers: Headers | undefined,
  paykit: Pick<PayKitContext, "options"> | undefined,
  field: string,
): string {
  const origin = resolveOrigin(request, headers, paykit);
  if (!origin) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.SUCCESS_URL_REQUIRED,
      `A ${field} is required when this method is called without a request context`,
    );
  }

  return new URL(value, origin).toString();
}

function resolveOrigin(
  request?: Request,
  headers?: Headers,
  paykit?: Pick<PayKitContext, "options">,
): string | null {
  let origin: string | null = null;

  if (request?.url) {
    origin = new URL("/", request.url).toString();
  } else {
    const explicitOrigin = headers?.get("origin");
    if (explicitOrigin && isAbsoluteUrl(explicitOrigin)) {
      origin = explicitOrigin.endsWith("/") ? explicitOrigin : `${explicitOrigin}/`;
    } else {
      const host = headers?.get("x-forwarded-host") ?? headers?.get("host");
      if (!host) {
        return null;
      }

      const protocol = headers?.get("x-forwarded-proto") ?? "https";
      origin = `${protocol}://${host}/`;
    }
  }

  if (origin && paykit?.options.trustedOrigins?.length) {
    assertTrustedOrigin(origin, paykit.options.trustedOrigins);
  }

  return origin;
}

function assertTrustedOrigin(origin: string, trustedOrigins: readonly string[]): void {
  const normalizedOrigin = normalizeTrustedOrigin(origin);
  const isAllowed = trustedOrigins.some((trustedOrigin) => {
    return normalizeTrustedOrigin(trustedOrigin) === normalizedOrigin;
  });

  if (!isAllowed) {
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.TRUSTED_ORIGIN_INVALID,
      `Resolved origin "${normalizedOrigin}" is not allowed by trustedOrigins`,
    );
  }
}

function normalizeTrustedOrigin(origin: string): string {
  return new URL(origin).origin;
}

function isAbsoluteUrl(value: string): boolean {
  try {
    void new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isAbsolutePath(value: string): boolean {
  return /^\/(?!\/)/u.test(value);
}

async function resolveCustomer(
  ctx: PayKitContext,
  request: Request | undefined,
  explicitCustomerId?: string,
): Promise<Customer> {
  if (ctx.options.identify && request) {
    const identity = await ctx.options.identify(request);

    if (!identity) {
      throw PayKitError.from("UNAUTHORIZED", PAYKIT_ERROR_CODES.IDENTIFY_REQUIRED);
    }

    if (explicitCustomerId && explicitCustomerId !== identity.customerId) {
      throw PayKitError.from("FORBIDDEN", PAYKIT_ERROR_CODES.CUSTOMER_ID_MISMATCH);
    }

    return upsertCustomer(ctx, {
      id: identity.customerId,
      email: identity.email,
      name: identity.name,
    });
  }

  if (request) {
    throw PayKitError.from("UNAUTHORIZED", PAYKIT_ERROR_CODES.IDENTIFY_REQUIRED);
  }

  if (explicitCustomerId) {
    return getCustomerByIdOrThrow(ctx.database, explicitCustomerId);
  }

  throw PayKitError.from("UNAUTHORIZED", PAYKIT_ERROR_CODES.CUSTOMER_ID_REQUIRED);
}
