import { Agent } from "@mastra/core/agent";
import { MCPClient } from "@mastra/mcp";

import { env, vercelGatewayModel } from "../../env";
import { buildDocsAgentInstructions } from "./instructions";

const docsMcpUrl = new URL(env.PAYKIT_DOCS_MCP_URL);

export const docsMcp = new MCPClient({
  id: "paykit-docs",
  servers: {
    paykitDocs: {
      url: docsMcpUrl,
      allowedHosts: [docsMcpUrl.host],
    },
  },
});

export const docsAgent = new Agent({
  id: "docs-agent",
  name: "PayKit Docs Assistant",
  instructions: ({ requestContext }) =>
    buildDocsAgentInstructions(requestContext.get("currentPage") as string | undefined),
  model: vercelGatewayModel,
  tools: async () => docsMcp.listTools(),
  defaultOptions: {
    maxSteps: 8,
  },
});
