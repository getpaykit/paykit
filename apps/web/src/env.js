import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),
    MASTRA_CHAT_SECRET: z.string().min(24),
    MASTRA_CHAT_URL:
      process.env.NODE_ENV === "development"
        ? z.url().default("http://localhost:4111/chat")
        : z.url(),
    RESEND_API_KEY: z.string().min(1),
    RESEND_FROM_EMAIL: z.string().email().default("contact@paykit.sh"),
    RESEND_TO_EMAIL: z.string().email().default("contact@paykit.sh"),
  },
  client: {
    NEXT_PUBLIC_APP_URL: z
      .string()
      .url()
      .default(
        process.env.NODE_ENV === "development" ? "http://localhost:3000" : "https://paykit.sh",
      ),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    MASTRA_CHAT_SECRET: process.env.MASTRA_CHAT_SECRET,
    MASTRA_CHAT_URL: process.env.MASTRA_CHAT_URL,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL,
    RESEND_TO_EMAIL: process.env.RESEND_TO_EMAIL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
