import { httpClient } from "../utils/httpClient";

export const statusTools = [
  {
    name: "hrm_get_employee_status",
    description: "Get work status for a specific employee by ID.",
    inputSchema: {
      type: "object",
      properties: {
        employee_id: { type: "number" },
      },
      required: ["employee_id"],
    },
    handler: async (args: unknown) => {
      const employeeId = (args as { employee_id: number }).employee_id;
      const res = await httpClient.get(`/brotecs_api/get_employee_status/${employeeId}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_my_status",
    description: "Get work status for the authenticated user.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/brotecs_api/get_my_status/");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
];
