import { handleWebhook } from "../../webhook/handle-webhook";
import { createPayKitEndpoint } from "../call";

function headersToRecord(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = value;
  });
  return result;
}

export const webhook = createPayKitEndpoint(
  "/webhook/:providerId",
  {
    method: "POST",
    disableBody: true,
    requireHeaders: true,
    requireRequest: true,
  },
  async (ctx) => {
    if (ctx.params.providerId !== ctx.context.provider.id) {
      throw ctx.error("BAD_REQUEST", {
        code: "INVALID_WEBHOOK_PROVIDER",
        message: "Webhook provider does not match this PayKit instance",
      });
    }

    const body = await ctx.request.text();

    return handleWebhook(ctx.context, {
      body,
      headers: headersToRecord(ctx.headers),
    });
  },
);
