import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
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

export const GET = (request: Request) => handler.fetch(request);
export const POST = (request: Request) => handler.fetch(request);
export const DELETE = (request: Request) => handler.fetch(request);
