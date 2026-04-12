import * as z from "zod";

export const dymoConfigSchema = z.object({
  apiKey: z.string().min(1, "Dymo API Key is required"),

  /**
   * Rules for blocking transactions.
   */
  rules: z
    .object({
      email: z
        .object({
          deny: z.array(z.string()).default(["FRAUD", "INVALID", "NO_MX_RECORDS"]),
        })
        .optional(),
      ip: z
        .object({
          deny: z.array(z.string()).default(["FRAUD", "VPN", "TOR_NETWORK"]),
        })
        .optional(),
    })
    .optional(),

  /**
   * Resilience configuration (Fail-Open logic).
   * If true, errors calling the Dymo API won't block the subscription.
   */
  resilience: z
    .object({
      enabled: z.boolean().default(true),
    })
    .default({ enabled: true }),
});

export type DymoConfig = z.infer<typeof dymoConfigSchema>;
