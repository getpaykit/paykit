import type { PayKitPlugin, BeforeSubscribeHookCtx } from "paykitjs";

import { createDymoClient } from "./client";
import { dymoConfigSchema, type DymoConfig, type DymoResponse } from "./schema";

/**
 * Creates a Dymo fraud detection plugin for PayKit.
 * Performs parallel email and IP fraud checks with a 5s timeout.
 */
export const DymoPlugin = (options: DymoConfig): PayKitPlugin => {
  const config = dymoConfigSchema.parse(options);
  const client = createDymoClient(config);

  return {
    id: "paykit-dymo-fraud",
    /**
     * Performs parallel fraud checks on email and IP before subscription.
     * Blocks subscription if fraud is detected, unless resilience is enabled.
     */
    async onBeforeSubscribe(ctx: BeforeSubscribeHookCtx) {
      try {
        const { customerEmail, ip } = ctx;

        const [emailResult, ipResult] = await Promise.all([
          customerEmail
            ? client.isValidEmail(customerEmail)
            : Promise.resolve<DymoResponse>({ allow: true, reasons: [] }),
          ip ? client.isValidIP(ip) : Promise.resolve<DymoResponse>({ allow: true, reasons: [] }),
        ]);

        if (!emailResult.allow || !ipResult.allow) {
          const reasons = [...(emailResult.reasons || []), ...(ipResult.reasons || [])];
          throw new Error(
            `Fraud detection blocked subscription for ${customerEmail || "unknown"}: ${reasons.join(", ")}`,
          );
        }
      } catch (error: unknown) {
        if (error instanceof Error && error.message.includes("Fraud detection")) {
          throw error;
        }

        if (config.resilience.enabled) {
          console.warn("[PayKit-Dymo] Resilience active: Skipping check.");
          return;
        }

        throw new Error("Fraud check service unavailable.", { cause: error });
      }
    },
  };
};
