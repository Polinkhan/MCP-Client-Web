import { z } from "zod";
import { login, clearToken, getToken, setToken } from "../auth/tokenStore";

export const authTools = [
  {
    name: "hrm_login",
    description: "Login to HRM API with username and password to obtain access token.",
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        password: { type: "string" },
      },
      required: ["username", "password"],
    },
    handler: async (args: unknown) => {
      const schema = z.object({ username: z.string(), password: z.string() });
      const { username, password } = schema.parse(args);
      try {
        await login(username, password);
        return {
          content: [
            {
              type: "text",
              text: "Successfully logged in. Access token obtained.",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Login failed: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    },
  },
  {
    name: "hrm_set_token",
    description: "Set or update the JWT token for HRM API access.",
    inputSchema: {
      type: "object",
      properties: {
        token: { type: "string" },
        expiresAtIso: { type: "string" },
      },
      required: ["token"],
    },
    handler: async (args: unknown) => {
      const schema = z.object({ token: z.string(), expiresAtIso: z.string().optional() });
      const { token, expiresAtIso } = schema.parse(args);
      setToken(token, expiresAtIso);
      return { content: [{ type: "text", text: "Token set successfully." }] };
    },
  },
  {
    name: "hrm_clear_token",
    description: "Clear JWT token from memory.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      clearToken();
      return { content: [{ type: "text", text: "Token cleared." }] };
    },
  },
  {
    name: "hrm_auth_state",
    description: "Check whether a JWT token is currently set.",
    inputSchema: { type: "object", properties: {} },
    handler: async () => {
      const hasToken = Boolean(getToken());
      return { content: [{ type: "text", text: hasToken ? "Authenticated" : "Not authenticated" }] };
    },
  },
];
