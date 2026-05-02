import { z } from "zod";
import { httpClient } from "../utils/httpClient";

export const attendanceTools = [
  {
    name: "get_my_today_attendance",
    description: "Get my today's attendance records with pagination support.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
      },
    },
    handler: async (args: unknown) => {
      const schema = z.object({ page: z.number().optional() });
      const { page } = schema.parse(args ?? {});
      const params = page ? { page } : {};
      const res = await httpClient.get("/attendance/attendance/", { params });

      if (Array.isArray(res.data.results)) {
        // Filter today's attendance records only
        const today = new Date().toISOString().slice(0, 10);
        res.data.results = res.data.results.filter((item: any) => item.attendance_date === today);
      }

      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "get_my_todays_attendance",
    description: "Get my today's attendance records with pagination support.",
    inputSchema: {
      type: "object",
      properties: {
        page: { type: "number" },
      },
    },
    handler: async (args: unknown) => {
      const schema = z.object({ page: z.number().optional() });
      const { page } = schema.parse(args ?? {});
      const params = page ? { page } : {};
      const res = await httpClient.get("/attendance/attendance/", { params });

      if (Array.isArray(res.data.results)) {
        // Filter today's attendance records only
        const today = new Date().toISOString().slice(0, 10);
        res.data.results = res.data.results.filter((item: any) => item.attendance_date === today);
      }

      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
  {
    name: "hrm_get_absent_employees",
    description: "Get list of employees who are absent today.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const res = await httpClient.get("/attendance/absent-employees/");
      return { content: [{ type: "text", text: JSON.stringify(res.data, null, 2) }] };
    },
  },
];
