import { createHash } from "node:crypto";

import * as z from "zod";

const payKitFeatureSymbol = Symbol.for("paykit.feature");
const payKitFeatureIncludeSymbol = Symbol.for("paykit.feature_include");
const payKitPlanSymbol = Symbol.for("paykit.plan");

const entityIdSchema = z
  .string()
  .min(1, "Id must not be empty")
  .max(64, "Id must be 64 characters or fewer")
  .regex(/^[a-z0-9_-]+$/, "Id must be lowercase alphanumeric with dashes or underscores");

const planNameSchema = z.string().min(1, "Plan name must not be empty");
const planGroupSchema = z.string().min(1, "Plan group must not be empty").max(64);
const priceSchema = z.object({
  amount: z
    .number()
    .positive("Price amount must be positive")
    .max(999_999.99, "Price amount must not exceed $999,999.99"),
  interval: z.enum(["month", "year"]),
});

const meteredFeatureConfigSchema = z.object({
  limit: z.number().int().positive("Feature limit must be a positive integer"),
  reset: z.enum(["day", "week", "month", "year"]),
});

function formatValidationError(
  entityType: "feature" | "feature include" | "plan",
  id: string,
  messages: string[],
): Error {
  return new Error(
    `Invalid ${entityType} "${id}":\n${messages.map((message) => `  - ${message}`).join("\n")}`,
  );
}

function deriveNameFromId(id: string): string {
  return id
    .split(/[-_]/u)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export type FeatureType = "boolean" | "metered";
export type PriceInterval = z.infer<typeof priceSchema>["interval"];
export type MeteredResetInterval = z.infer<typeof meteredFeatureConfigSchema>["reset"];
export type PlanPrice = z.infer<typeof priceSchema>;
export type MeteredFeatureConfig = z.infer<typeof meteredFeatureConfigSchema>;

export interface PayKitFeatureDefinition<
  TId extends string = string,
  TType extends FeatureType = FeatureType,
> {
  id: TId;
  type: TType;
}

type BooleanFeatureDefinition<TId extends string = string> = PayKitFeatureDefinition<
  TId,
  "boolean"
>;
type MeteredFeatureDefinition<TId extends string = string> = PayKitFeatureDefinition<
  TId,
  "metered"
>;

type BooleanFeatureInclude<TFeature extends BooleanFeatureDefinition = BooleanFeatureDefinition> =
  Readonly<{
    config: undefined;
    feature: TFeature;
  }>;

type MeteredFeatureInclude<TFeature extends MeteredFeatureDefinition = MeteredFeatureDefinition> =
  Readonly<{
    config: MeteredFeatureConfig;
    feature: TFeature;
  }>;

export type PayKitFeatureInclude =
  | BooleanFeatureInclude<BooleanFeatureDefinition>
  | MeteredFeatureInclude<MeteredFeatureDefinition>;

type BooleanFeatureCallable<TFeature extends BooleanFeatureDefinition> =
  (() => BooleanFeatureInclude<TFeature>) & Readonly<TFeature>;

type MeteredFeatureCallable<TFeature extends MeteredFeatureDefinition> = ((
  config: MeteredFeatureConfig,
) => MeteredFeatureInclude<TFeature>) &
  Readonly<TFeature>;

export type PayKitFeature<TFeature extends PayKitFeatureDefinition = PayKitFeatureDefinition> =
  TFeature extends BooleanFeatureDefinition
    ? BooleanFeatureCallable<TFeature>
    : TFeature extends MeteredFeatureDefinition
      ? MeteredFeatureCallable<TFeature>
      : never;

export interface PayKitPlanConfig<TId extends string = string> {
  default?: boolean;
  group?: string;
  id: TId;
  includes?: readonly PayKitFeatureInclude[];
  name?: string;
  price?: PlanPrice;
}

export type PayKitPlan<TConfig extends PayKitPlanConfig = PayKitPlanConfig> = Readonly<
  Omit<TConfig, "includes"> & {
    includes: TConfig["includes"] extends readonly PayKitFeatureInclude[]
      ? TConfig["includes"]
      : readonly PayKitFeatureInclude[];
  }
>;

export interface NormalizedPlanFeature {
  config: Record<string, unknown> | null;
  id: string;
  limit: number | null;
  resetInterval: MeteredResetInterval | null;
  type: FeatureType;
}

export interface NormalizedPlan {
  group: string;
  hash: string;
  id: string;
  includes: readonly NormalizedPlanFeature[];
  isDefault: boolean;
  name: string;
  priceAmount: number | null;
  priceCurrency: string | null;
  priceInterval: PriceInterval | null;
  trialDays: number | null;
}

export interface NormalizedFeature {
  id: string;
  type: FeatureType;
}

export interface NormalizedSchema {
  features: readonly NormalizedFeature[];
  plans: readonly NormalizedPlan[];
  planMap: ReadonlyMap<string, NormalizedPlan>;
}

export type PayKitProductsModule = readonly PayKitPlan[];

export type PlanIdFromProducts<TProducts> = TProducts extends readonly (infer TItem)[]
  ? TItem extends PayKitPlan<PayKitPlanConfig<infer TId>>
    ? TId
    : never
  : never;

type ExtractFeatureIds<TPlan> = TPlan extends {
  includes: readonly (infer TInclude)[];
}
  ? TInclude extends { feature: { id: infer TId extends string } }
    ? TId
    : never
  : never;

export type FeatureIdFromProducts<TProducts> = TProducts extends readonly (infer TItem)[]
  ? ExtractFeatureIds<TItem>
  : never;

function defineHiddenBrand(target: object, symbol: symbol): void {
  Object.defineProperty(target, symbol, {
    configurable: false,
    enumerable: false,
    value: true,
    writable: false,
  });
}

export function isPayKitFeature(value: unknown): value is PayKitFeature {
  return (
    typeof value === "function" &&
    (value as unknown as Record<PropertyKey, unknown>)[payKitFeatureSymbol] === true
  );
}

export function isPayKitFeatureInclude(value: unknown): value is PayKitFeatureInclude {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<PropertyKey, unknown>)[payKitFeatureIncludeSymbol] === true
  );
}

export function isPayKitPlan(value: unknown): value is PayKitPlan {
  return (
    value !== null &&
    typeof value === "object" &&
    (value as Record<PropertyKey, unknown>)[payKitPlanSymbol] === true
  );
}

export function feature<const TId extends string, const TType extends FeatureType>(definition: {
  id: TId;
  type: TType;
}): PayKitFeature<PayKitFeatureDefinition<TId, TType>> {
  const parsedId = entityIdSchema.safeParse(definition.id);
  if (!parsedId.success) {
    throw formatValidationError(
      "feature",
      typeof definition.id === "string" ? definition.id : "<unknown>",
      parsedId.error.issues.map((issue) => issue.message),
    );
  }

  const featureType =
    definition.type === "boolean" || definition.type === "metered" ? definition.type : null;
  if (!featureType) {
    throw formatValidationError("feature", parsedId.data, [
      "Feature type must be boolean or metered",
    ]);
  }

  const featureDefinition = Object.freeze({
    id: parsedId.data,
    type: featureType,
  }) as PayKitFeatureDefinition<TId, TType>;

  const featureFactory = ((config?: MeteredFeatureConfig) => {
    if (featureDefinition.type === "boolean") {
      if (config !== undefined) {
        throw formatValidationError("feature include", featureDefinition.id, [
          `Boolean feature "${featureDefinition.id}" does not accept config`,
        ]);
      }

      const include = {
        config: undefined,
        feature: featureDefinition,
      } as BooleanFeatureInclude<BooleanFeatureDefinition<TId>>;
      defineHiddenBrand(include, payKitFeatureIncludeSymbol);
      return Object.freeze(include);
    }

    const parsedConfig = meteredFeatureConfigSchema.safeParse(config);
    if (!parsedConfig.success) {
      throw formatValidationError(
        "feature include",
        featureDefinition.id,
        parsedConfig.error.issues.map((issue) => issue.message),
      );
    }

    const include = {
      config: parsedConfig.data,
      feature: featureDefinition,
    } as MeteredFeatureInclude<MeteredFeatureDefinition<TId>>;
    defineHiddenBrand(include, payKitFeatureIncludeSymbol);
    return Object.freeze(include);
  }) as PayKitFeature<PayKitFeatureDefinition<TId, TType>>;

  Object.defineProperties(featureFactory, {
    id: {
      configurable: false,
      enumerable: true,
      value: featureDefinition.id,
      writable: false,
    },
    type: {
      configurable: false,
      enumerable: true,
      value: featureDefinition.type,
      writable: false,
    },
  });
  defineHiddenBrand(featureFactory, payKitFeatureSymbol);

  return featureFactory;
}

export function plan<const TConfig extends PayKitPlanConfig>(config: TConfig): PayKitPlan<TConfig> {
  const result = z
    .object({
      default: z.boolean().optional(),
      group: planGroupSchema.optional(),
      id: entityIdSchema,
      includes: z.array(z.unknown()).optional(),
      name: planNameSchema.optional(),
      price: priceSchema.optional(),
    })
    .safeParse(config);

  if (!result.success) {
    const id = typeof config?.id === "string" ? config.id : "<unknown>";
    throw formatValidationError(
      "plan",
      id,
      result.error.issues.map((issue) => issue.message),
    );
  }

  const parsed = result.data;
  const includes = parsed.includes ?? [];
  const invalidInclude = includes.find((include) => !isPayKitFeatureInclude(include));
  if (invalidInclude) {
    throw formatValidationError("plan", parsed.id, [
      "Includes must contain values returned by feature(...)",
    ]);
  }

  if (parsed.default && !parsed.group) {
    throw formatValidationError("plan", parsed.id, ['Default plans must define a "group"']);
  }

  const builtPlan = {
    ...parsed,
    includes: includes as readonly PayKitFeatureInclude[],
  } as PayKitPlan<TConfig>;
  defineHiddenBrand(builtPlan, payKitPlanSymbol);

  return Object.freeze(builtPlan);
}

export function computePlanHash(plan: Omit<NormalizedPlan, "hash">): string {
  const payload = JSON.stringify({
    group: plan.group,
    isDefault: plan.isDefault,
    priceAmount: plan.priceAmount,
    priceCurrency: plan.priceCurrency,
    priceInterval: plan.priceInterval,
    features: plan.includes.map((f) => ({
      id: f.id,
      limit: f.limit,
      resetInterval: f.resetInterval,
      config: f.config,
    })),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function normalizeSchema(
  products: PayKitProductsModule | undefined,
  input?: { priceCurrency?: string },
): NormalizedSchema {
  if (!products) {
    return {
      features: [],
      plans: [],
      planMap: new Map(),
    };
  }

  if (!Array.isArray(products)) {
    throw new Error(
      "Invalid `products` export. Expected an array of values returned by plan(...).",
    );
  }

  const exportedPlans = products.map((planValue, index) => {
    if (!isPayKitPlan(planValue)) {
      throw new Error(`Invalid plan at index ${index}. Expected values returned by plan(...).`);
    }
    return planValue;
  });
  const features = new Map<string, NormalizedFeature>();
  const defaultPlansByGroup = new Map<string, string>();
  const plansById = new Map<string, NormalizedPlan>();

  for (const exportedPlan of exportedPlans) {
    if (plansById.has(exportedPlan.id)) {
      throw new Error(`Duplicate plan id "${exportedPlan.id}" found in products exports.`);
    }

    const group = exportedPlan.group ?? "";
    const isDefault = exportedPlan.default ?? false;
    if (isDefault) {
      const existingDefaultPlanId = defaultPlansByGroup.get(group);
      if (existingDefaultPlanId) {
        throw new Error(
          `Group "${group}" has multiple default plans: "${existingDefaultPlanId}" and "${exportedPlan.id}".`,
        );
      }
      defaultPlansByGroup.set(group, exportedPlan.id);
    }

    const includes = exportedPlan.includes.map((include) => {
      const existingFeature = features.get(include.feature.id);
      if (existingFeature && existingFeature.type !== include.feature.type) {
        throw new Error(
          `Feature "${include.feature.id}" is declared with conflicting types: "${existingFeature.type}" and "${include.feature.type}".`,
        );
      }

      features.set(include.feature.id, {
        id: include.feature.id,
        type: include.feature.type,
      });

      if (include.feature.type === "metered") {
        const config = include.config;
        if (!config) {
          throw new Error(`Metered feature "${include.feature.id}" requires config.`);
        }

        return {
          config,
          id: include.feature.id,
          limit: config.limit,
          resetInterval: config.reset,
          type: include.feature.type,
        } satisfies NormalizedPlanFeature;
      }

      return {
        config: null,
        id: include.feature.id,
        limit: null,
        resetInterval: null,
        type: include.feature.type,
      } satisfies NormalizedPlanFeature;
    });

    // oxlint-disable-next-line unicorn/no-array-sort -- spread copy, original not mutated
    const sortedIncludes = [...includes].sort((left, right) => left.id.localeCompare(right.id));
    const planData = {
      group,
      id: exportedPlan.id,
      includes: sortedIncludes,
      isDefault,
      name: exportedPlan.name ?? deriveNameFromId(exportedPlan.id),
      priceAmount: exportedPlan.price ? Math.round(exportedPlan.price.amount * 100) : null,
      priceCurrency: exportedPlan.price ? (input?.priceCurrency ?? "usd") : null,
      priceInterval: exportedPlan.price?.interval ?? null,
      trialDays: null,
    };
    plansById.set(exportedPlan.id, { ...planData, hash: computePlanHash(planData) });
  }

  // oxlint-disable-next-line unicorn/no-array-sort -- spread copy, original not mutated
  const sortedPlans = [...plansById.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  return {
    // oxlint-disable-next-line unicorn/no-array-sort -- spread copy, original not mutated
    features: [...features.values()].sort((left, right) => left.id.localeCompare(right.id)),
    plans: sortedPlans,
    planMap: plansById,
  };
}
