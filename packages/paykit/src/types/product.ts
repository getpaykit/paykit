import * as z from "zod";

const productIdSchema = z
  .string()
  .min(1, "Product id must not be empty")
  .max(64, "Product id must be 64 characters or fewer")
  .regex(/^[a-z0-9_-]+$/, "Product id must be lowercase alphanumeric with dashes or underscores");

const priceSchema = z.object({
  amount: z
    .number()
    .positive("Price amount must be positive")
    .max(999_999.99, "Price amount must not exceed $999,999.99"),
  interval: z.enum(["month", "year"]).optional(),
});

const productConfigSchema = z.object({
  id: productIdSchema,
  name: z.string().min(1, "Product name must not be empty"),
  price: priceSchema,
});

export type PriceInterval = z.infer<typeof priceSchema>["interval"];
export type ProductPrice = z.infer<typeof priceSchema>;
export type ProductConfig = z.infer<typeof productConfigSchema>;

export type Product = Readonly<ProductConfig> & {
  /** Price amount in cents, derived from the dollar amount. */
  readonly priceAmountCents: number;
};

export function product(config: ProductConfig): Product {
  const result = productConfigSchema.safeParse(config);

  if (!result.success) {
    const id = typeof config?.id === "string" ? config.id : "<unknown>";
    const messages = result.error.issues.map((issue) => `  - ${issue.message}`).join("\n");
    throw new Error(`Invalid product "${id}":\n${messages}`);
  }

  const parsed = result.data;
  const priceAmountCents = Math.round(parsed.price.amount * 100);

  return Object.freeze({
    ...parsed,
    priceAmountCents,
  });
}
