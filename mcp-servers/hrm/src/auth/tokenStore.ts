import axios from "axios";
import { config } from "../config";

let currentToken: string | null = null;
let tokenExpiresAtIso: string | null = null;

export function setToken(token: string, expiresAtIso?: string) {
  currentToken = token;
  tokenExpiresAtIso = expiresAtIso ?? null;
}

export function clearToken() {
  currentToken = null;
  tokenExpiresAtIso = null;
}

export function getToken(): string | null {
  if (!currentToken) return null;
  if (tokenExpiresAtIso) {
    const expiresAt = new Date(tokenExpiresAtIso).getTime();
    if (Number.isFinite(expiresAt) && Date.now() > expiresAt) {
      currentToken = null;
      tokenExpiresAtIso = null;
      return null;
    }
  }
  return currentToken;
}

export function getAuthHeader(): { Authorization: string } | {} {
  const token = getToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function login(username: string, password: string): Promise<string> {
  const loginUrl = `${config.hrmApiBaseUrl}${config.endpoints.login}`;
  const response = await axios.post(loginUrl, { username, password });
  const accessToken = response.data.access;
  if (accessToken) {
    setToken(accessToken);
  }
  return accessToken;
}

/**
 * Load token or log in with HRM_API_USERNAME / HRM_API_PASSWORD before MCP stdio runs.
 * Must be awaited so the first tool call already has a Bearer token.
 * Logs only to stderr — stdout is reserved for MCP JSON-RPC.
 */
export async function initializeAuthFromEnv(): Promise<void> {
  const token = process.env.HRM_API_TOKEN?.trim();
  if (token) {
    setToken(token, process.env.HRM_API_TOKEN_EXPIRES_AT);
    return;
  }

  const username = config.credentials.username;
  const password = config.credentials.password;

  if (!username || !password) {
    return;
  }

  try {
    const access = await login(username, password);
    if (!access) {
      throw new Error("Login response had no access token (expected `access` in JSON body)");
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // eslint-disable-next-line no-console
    console.error("[hrm-mcp] HRM_API_USERNAME / HRM_API_PASSWORD login failed:", msg);
    throw e;
  }
}
