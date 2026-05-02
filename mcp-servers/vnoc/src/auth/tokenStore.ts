import { config } from "../config";

export function getAuthHeader(): { Authorization: string } | {} {
  const token = config.token;
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
