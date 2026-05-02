import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { apiTools } from "./api.tools";
import { hostTools } from "./host.tools";
import { metricTools } from "./metric.tools";
import { elasticsearchTools } from "./elasticsearch.tools";

// Combine all tools
const allTools = [...apiTools, ...hostTools, ...metricTools, ...elasticsearchTools];

export function registerVNocTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = allTools.find((t) => t.name === req.params?.name);
    if (!tool) {
      return {
        content: [{ type: "text", text: `Tool not found: ${req.params?.name}` }],
        isError: true,
      };
    }
    const result = await tool.handler(req.params?.arguments ?? {});
    return result;
  });
}

