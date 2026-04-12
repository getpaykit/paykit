import type { PayKitPlugin, BeforeSubscribeHookCtx } from "paykitjs";

import { createDymoClient, type DymoResponse } from "./client";
import { dymoConfigSchema, type DymoConfig } from "./schema";

export class DymoPlugin implements PayKitPlugin {
  id = "paykit-dymo-fraud";
  private client;
  private config;

  constructor(options: DymoConfig) {
    this.config = dymoConfigSchema.parse(options);
    this.client = createDymoClient(this.config);
  }

  async onBeforeSubscribe(ctx: BeforeSubscribeHookCtx) {
    try {
      // DATA FETCH: No more DB calls here! Core provides it.
      const { customerEmail, ip } = ctx;

      const [emailResult, ipResult] = await Promise.all([
        customerEmail
          ? this.client.isValidEmail(customerEmail)
          : Promise.resolve<DymoResponse>({ allow: true, reasons: [] }),
        ip
          ? this.client.isValidIP(ip)
          : Promise.resolve<DymoResponse>({ allow: true, reasons: [] }),
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

      if (this.config.resilience.enabled) {
        console.warn("[PayKit-Dymo] Resilience active: Skipping check.");
        return;
      }

      throw new Error("Fraud check service unavailable.", { cause: error });
    }
  }
}
