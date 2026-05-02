import { httpClient } from "../utils/httpClient";

export const dashboardTools = [
  {
    name: "hrm_get_upcoming_holidays",
    description: "Get upcoming holidays with pagination support.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        page_size: { type: "number" },
      },
    },
    handler: async (args: unknown) => {
      const params: Record<string, unknown> = {};
      if (args && typeof args === "object") {
        const typedArgs = args as Record<string, unknown>;
        if (typedArgs.page !== undefined) params.page = typedArgs.page;
        if (typedArgs.page_size !== undefined) params.page_size = typedArgs.page_size;
      }
      const res = await httpClient.get("/brotecs/holidays", { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_check_in_status_enabled",
    description: "Check if web punch-in is enabled for the authenticated user.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/brotecs/check-in-status/");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_announcements",
    description: "Get announcements with pagination support.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
        page_size: { type: "number" },
      },
    },
    handler: async (args: unknown) => {
      const params: Record<string, unknown> = {};
      if (args && typeof args === "object") {
        const typedArgs = args as Record<string, unknown>;
        if (typedArgs.page !== undefined) params.page = typedArgs.page;
        if (typedArgs.page_size !== undefined) params.page_size = typedArgs.page_size;
      }
      const res = await httpClient.get("/brotecs/announcements", { params });
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_announcements_by_count",
    description: "Get a specific number of announcements. Provide the count in the endpoint.",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number" },
      },
      required: ["count"],
    },
    handler: async (args: unknown) => {
      const count = (args as { count: number }).count;
      const res = await httpClient.get(`/brotecs/announcements/${count}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_today_dashboard",
    description: "Get today's dashboard with attendance statistics and employee information.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/brotecs/today-dashboard");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_app_dashboard",
    description: "Get app dashboard data with employee details, attendance stats, and leave information.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/brotecs/app-dashboard");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_month_wise_attendance",
    description: "Get month-wise attendance statistics. Provide year-month in format YYYY-MM (e.g., 2025-06).",
    inputSchema: {
      type: "object",
      properties: {
        year_month: { type: "string" },
      },
      required: ["year_month"],
    },
    handler: async (args: unknown) => {
      const yearMonth = (args as { year_month: string }).year_month;
      const res = await httpClient.get(`/brotecs/month-wise-attendance/${yearMonth}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_employee_profile",
    description: "Get employee profile information by employee ID.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "number" },
      },
      required: ["id"],
    },
    handler: async (args: unknown) => {
      const id = (args as { id: number }).id;
      const res = await httpClient.get(`/brotecs/employee-profile/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
];
