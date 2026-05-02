import { httpClient } from "../utils/httpClient";

export const leaveTools = [
  {
    name: "hrm_get_available_leaves",
    description: "Get available leaves information for the authenticated employee.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/brotecs/available-leaves");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_leave_requests",
    description:
      "Get leave requests for the authenticated employee. Supports filtering by status, leave_type_id, and date range.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        leave_type_id: { type: "number" },
        start_date: { type: "string" },
        end_date: { type: "string" },
        page: { type: "number" },
        page_size: { type: "number" },
      },
    },
    handler: async (args: unknown) => {
      const params: Record<string, unknown> = {};
      if (args && typeof args === "object") {
        const typedArgs = args as Record<string, unknown>;
        if (typedArgs.status !== undefined) params.status = typedArgs.status;
        if (typedArgs.leave_type_id !== undefined) params.leave_type_id = typedArgs.leave_type_id;
        if (typedArgs.start_date !== undefined) params.start_date = typedArgs.start_date;
        if (typedArgs.end_date !== undefined) params.end_date = typedArgs.end_date;
        if (typedArgs.page !== undefined) params.page = typedArgs.page;
        if (typedArgs.page_size !== undefined) params.page_size = typedArgs.page_size;
      }
      const res = await httpClient.get("/brotecs/leave-requests/", { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_employees_on_leave",
    description: "Get list of employees who have taken leave on the current date.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/brotecs/employees-on-leave");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_monthwise_lates",
    description: "Get month-wise late statistics for the authenticated employee.",
    inputSchema: {
      type: "object",
      properties: {
        month: { type: "string" },
      },
    },
    handler: async (args: unknown) => {
      const params: Record<string, unknown> = {};
      if (args && typeof args === "object") {
        const typedArgs = args as Record<string, unknown>;
        if (typedArgs.month !== undefined) params.month = typedArgs.month;
      }
      const res = await httpClient.get("/brotecs_api/get_monthwise_lates/", { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
];
