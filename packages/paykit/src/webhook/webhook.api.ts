import { definePayKitMethod } from "../api/define-route";
import { handleWebhook } from "./webhook.service";

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

function shouldAllowUnsignedPayload(headers: Headers): boolean {
  if (headers.get("x-paykit-cloud-replay") !== "1") {
    return false;
  }

  return (
    process.env.PAYKIT_ALLOW_UNSIGNED_PAYLOADS === "1" ||
    // Legacy alias kept for local replay compatibility; remove in a future major.
    process.env.PAYKIT_ALLOW_STALE_SIGNATURES === "1" ||
    process.env.NODE_ENV === "development" ||
    process.env.NODE_ENV === "test"
  );
}

/** Applies an incoming provider webhook payload. */
export const receiveWebhook = definePayKitMethod(
  {
    route: {
      disableBody: true,
      method: "POST",
      path: "/webhook",
      requireHeaders: true,
      requireRequest: true,
      resolveInput: async (ctx) => {
        const headers = ctx.headers ?? new Headers();
        return {
          allowUnsignedPayload: shouldAllowUnsignedPayload(headers),
          body: await ctx.request!.text(),
          headers: headersToRecord(headers),
        };
      },
    },
  },
  // TODO: if we'll add multiple providers on one app, we gotta make sure detecting provider based on request HERE
  async (ctx) => handleWebhook(ctx.paykit, ctx.input),
);
