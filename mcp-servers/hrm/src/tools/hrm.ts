import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { authTools } from "./auth.tools";
import { attendanceTools } from "./attendance.tools";
import { dashboardTools } from "./dashboard.tools";
import { leaveTools } from "./leave.tools";
import { statusTools } from "./status.tools";

// Combine all tools
const allTools = [...authTools, ...attendanceTools, ...dashboardTools, ...leaveTools, ...statusTools];

export function registerHRMTools(server: Server) {
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: allTools.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const tool = allTools.find((t) => t.name === req.params?.name);
    if (!tool) {
      return { content: [{ type: "text", text: `Tool not found: ${req.params?.name}` }], isError: true };
    }
    const result = await tool.handler(req.params?.arguments ?? {});
    return result;
  });
}
