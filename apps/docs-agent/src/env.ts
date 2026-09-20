import { z } from "zod";

const optionalString = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    AI_GATEWAY_API_KEY: z.string().min(1),
    AI_GATEWAY_MODEL: z.string().min(1),
    MASTRA_CHAT_SECRET: z.string().min(24),
    MASTRA_STORAGE_URL: z.string().startsWith("file:").optional(),
    PAYKIT_DOCS_MCP_URL: z.string().url().default("http://localhost:3000/api/mcp"),
    TURSO_AUTH_TOKEN: optionalString,
    TURSO_DATABASE_URL: optionalString,
  })
  .superRefine((value, context) => {
    if (Boolean(value.TURSO_DATABASE_URL) !== Boolean(value.TURSO_AUTH_TOKEN)) {
      context.addIssue({
        code: "custom",
        message: "TURSO_DATABASE_URL and TURSO_AUTH_TOKEN must be configured together.",
        path: [value.TURSO_DATABASE_URL ? "TURSO_AUTH_TOKEN" : "TURSO_DATABASE_URL"],
      });
    }
  });

export const env = envSchema.parse(process.env);

export const vercelGatewayModel = (
  env.AI_GATEWAY_MODEL.startsWith("vercel/")
    ? env.AI_GATEWAY_MODEL
    : `vercel/${env.AI_GATEWAY_MODEL}`
) as `${string}/${string}`;
