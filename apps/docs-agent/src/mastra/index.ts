import { chatRoute } from "@mastra/ai-sdk";
import { Mastra } from "@mastra/core/mastra";
import { SimpleAuth } from "@mastra/core/server";
import { PinoLogger } from "@mastra/loggers";
import {
  MastraPlatformExporter,
  MastraStorageExporter,
  Observability,
  SensitiveDataFilter,
} from "@mastra/observability";

import { env } from "../env";
import { docsAgent } from "./agents/docs-agent";
import {
  docsAnswerQualityScorer,
  docsCitationScorer,
  docsToolUseScorer,
} from "./scorers/docs-scorers";
import { storage } from "./storage";

export const mastra = new Mastra({
  agents: { docsAgent },
  scorers: {
    docsAnswerQuality: docsAnswerQualityScorer,
    docsCitation: docsCitationScorer,
    docsToolUse: docsToolUseScorer,
  },
  storage,
  logger: new PinoLogger({ name: "paykit-docs-agent", level: "info" }),
  observability: new Observability({
    configs: {
      default: {
        serviceName: "paykit-docs-agent",
        exporters: [new MastraStorageExporter(), new MastraPlatformExporter()],
        spanOutputProcessors: [new SensitiveDataFilter()],
      },
    },
  }),
  server: {
    auth: new SimpleAuth({
      tokens: {
        [env.MASTRA_CHAT_SECRET]: {
          id: "paykit-web",
          name: "PayKit documentation website",
        },
      },
    }),
    apiRoutes: [
      chatRoute({
        path: "/chat",
        agent: "docs-agent",
        version: "v7",
        heartbeatMs: 15_000,
        defaultOptions: { maxSteps: 8 },
        onError: () => "The PayKit assistant could not complete this request.",
      }),
    ],
    middleware: [
      {
        path: "/chat",
        handler: async (context, next) => {
          if (context.req.method === "POST") {
            const body = (await context.req.raw
              .clone()
              .json()
              .catch(() => undefined)) as { data?: { currentPage?: unknown } } | undefined;
            const currentPage = body?.data?.currentPage;

            if (
              typeof currentPage === "string" &&
              currentPage.length <= 512 &&
              (currentPage === "/docs" || currentPage.startsWith("/docs/")) &&
              !currentPage.includes("\\")
            ) {
              context.get("requestContext").set("currentPage", currentPage);
            }
          }

          await next();
        },
      },
    ],
  },
});
