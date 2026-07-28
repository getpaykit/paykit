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
    const routeMetadata = config.requireCustomer
      ? { ...config.route.metadata, allowedMediaTypes: ["application/json"] }
      : config.route.metadata;
    const endpoint = createPayKitEndpoint(
      config.route.path,
      {
        body: createRouteInputSchema(config.input),
        ...config.route,
        client: undefined,
        metadata: routeMetadata,
        path: undefined,
        resolveInput: undefined,
      },
      async (ctx) => {
        if (config.requireCustomer && ctx.request) {
          assertAuthenticatedRequestOrigin(ctx.context, ctx.request);
        }
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
  paykit?: Pick<PayKitContext, "logger" | "options">,
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

  return Object.keys(overrides).length > 0 ? schema.extend(overrides) : schema;
}

function createRoutedReturnUrlSchema(field: string, schema: unknown): z.ZodTypeAny {
  const typedSchema = schema as z.ZodTypeAny;
  if (typedSchema instanceof z.ZodOptional) {
    return createRoutedReturnUrlSchema(field, typedSchema.unwrap()).optional();
  }

  const routedSchema = z.string();

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
  paykit?: Pick<PayKitContext, "logger" | "options">,
): string {
  if (isAbsolutePath(value)) {
    return resolveAbsoluteUrl(value, request, headers, paykit, field);
  }

  const parsed = parseHttpUrl(value, field, paykit);
  if (request) {
    assertTrustedOrigin(parsed.origin, request, paykit, field);
  }
  return parsed.toString();
}

function shouldDefaultReturnUrlField(field: string): boolean {
  return field !== "cancelUrl";
}

function resolveAbsoluteUrl(
  value: string,
  request: Request | undefined,
  headers: Headers | undefined,
  paykit: Pick<PayKitContext, "logger" | "options"> | undefined,
  field: string,
): string {
  const origin = resolveOrigin(request, headers, paykit, field);
  if (!origin) {
    paykit?.logger.warn(
      { code: PAYKIT_ERROR_CODES.RETURN_URL_ORIGIN_REQUIRED.code, field },
      "Could not resolve a relative PayKit provider return URL",
    );
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.RETURN_URL_ORIGIN_REQUIRED,
      `${field} must be absolute when this method is called without a browser request context`,
    );
  }

  return new URL(value, origin).toString();
}

function resolveOrigin(
  request?: Request,
  headers?: Headers,
  paykit?: Pick<PayKitContext, "logger" | "options">,
  field?: string,
): string | null {
  const requestOrigin = request ? getHttpOrigin(request.url) : null;
  const browserOrigin = getBrowserOrigin(headers ?? request?.headers);

  if (browserOrigin) {
    if (!request) {
      return `${browserOrigin}/`;
    }
    assertTrustedOrigin(browserOrigin, request, paykit, field);
    return `${browserOrigin}/`;
  }

  return requestOrigin ? `${requestOrigin}/` : null;
}

function assertTrustedOrigin(
  origin: string,
  request: Request,
  paykit?: Pick<PayKitContext, "logger" | "options">,
  field?: string,
): void {
  const requestOrigin = getHttpOrigin(request.url);
  const trustedOrigins = [requestOrigin, ...(paykit?.options.trustedOrigins ?? [])].filter(
    (value): value is string => Boolean(value),
  );
  const normalizedOrigin = normalizeTrustedOrigin(origin);
  const isAllowed = trustedOrigins.some(
    (trustedOrigin) => normalizeTrustedOrigin(trustedOrigin) === normalizedOrigin,
  );

  if (!isAllowed) {
    paykit?.logger.warn(
      {
        code: PAYKIT_ERROR_CODES.TRUSTED_ORIGIN_INVALID.code,
        field,
        origin: normalizedOrigin,
        trustedOrigins: trustedOrigins.map(normalizeTrustedOrigin),
      },
      "Rejected untrusted PayKit browser or return URL origin",
    );
    throw PayKitError.from(
      "FORBIDDEN",
      PAYKIT_ERROR_CODES.TRUSTED_ORIGIN_INVALID,
      `Origin "${normalizedOrigin}" is not trusted. Add it to createPayKit({ trustedOrigins: ["${normalizedOrigin}"] }) when the frontend and PayKit API use different origins.`,
    );
  }
}

function assertAuthenticatedRequestOrigin(paykit: PayKitContext, request: Request): void {
  if (!request.headers.has("cookie")) {
    return;
  }

  const originHeader = request.headers.get("origin");
  if (originHeader === "null" && request.headers.get("sec-fetch-site") === "same-origin") {
    return;
  }

  const browserOrigin = getBrowserOrigin(request.headers);
  if (!browserOrigin) {
    paykit.logger.warn(
      { code: PAYKIT_ERROR_CODES.REQUEST_ORIGIN_REQUIRED.code },
      "Rejected authenticated PayKit request without a browser origin",
    );
    throw PayKitError.from(
      "FORBIDDEN",
      PAYKIT_ERROR_CODES.REQUEST_ORIGIN_REQUIRED,
      "Authenticated browser requests must include a valid Origin or Referer header",
    );
  }

  assertTrustedOrigin(browserOrigin, request, paykit);
}

function normalizeTrustedOrigin(origin: string): string {
  return new URL(origin).origin;
}

function isAbsolutePath(value: string): boolean {
  return (
    /^\/(?!\/)/u.test(value) &&
    !value.includes("\\") &&
    !hasControlCharacters(value) &&
    !/%(?:2f|5c|0[0-9a-f]|1[0-9a-f]|7f)/iu.test(value)
  );
}

function parseHttpUrl(
  value: string,
  field: string,
  paykit?: Pick<PayKitContext, "logger" | "options">,
): URL {
  try {
    const parsed = new URL(value);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      parsed.username ||
      parsed.password ||
      hasControlCharacters(value)
    ) {
      throw new TypeError("Unsupported URL");
    }
    return parsed;
  } catch {
    paykit?.logger.warn(
      { code: PAYKIT_ERROR_CODES.RETURN_URL_INVALID.code, field },
      "Rejected invalid PayKit provider return URL",
    );
    throw PayKitError.from(
      "BAD_REQUEST",
      PAYKIT_ERROR_CODES.RETURN_URL_INVALID,
      `${field} must be an HTTP(S) URL or a safe absolute path`,
    );
  }
}

function getBrowserOrigin(headers?: Headers): string | null {
  const value = headers?.get("origin") ?? headers?.get("referer");
  return value ? getHttpOrigin(value) : null;
}

function getHttpOrigin(value: string): string | null {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.origin : null;
  } catch {
    return null;
  }
}

function hasControlCharacters(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint <= 31 || codePoint === 127;
  });
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
