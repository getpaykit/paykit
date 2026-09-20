import {
  createMcpHandler,
  hostHeaderValidationResponse,
  McpServer,
  originValidationResponse,
} from "@modelcontextprotocol/server";
import { registerSearchTool, registerSourceTools } from "fumadocs-core/mcp";

import { docsLlms, docsSearch, source } from "@/lib/source";

const handler = createMcpHandler(() => {
  const server = new McpServer({
    name: "paykit-docs",
    version: "1.0.0",
  });

  registerSearchTool(server, docsSearch);
  registerSourceTools(server, source, docsLlms);

  return server;
});

function fetchMcp(request: Request) {
  const hostname = new URL(request.url).hostname;
  const rejected =
    hostHeaderValidationResponse(request, [hostname]) ??
    originValidationResponse(request, [hostname]);
  return rejected ?? handler.fetch(request);
}

export const GET = fetchMcp;
export const POST = fetchMcp;
export const DELETE = fetchMcp;
