import {
  getMcpConfigBodyFromDb,
  getMcpConfigMetaFromDb,
} from "@/server/db/mcp-config-repo.js";

/**
 * Cursor-style MCP config: { "mcpServers": { "name": { command, args?, env?, cwd?, disabled? } } }
 * Loaded only from SQLite (`mcp_config`). `disabled: true` skips a server.
 */

function parseSaved() {
  const raw = getMcpConfigBodyFromDb();
  if (raw == null || raw.trim() === "") return { state: "empty" };
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { state: "invalid", reason: "Root must be a JSON object" };
    }
    return { state: "ok", parsed };
  } catch (e) {
    return {
      state: "invalid",
      reason: e instanceof Error ? e.message : "Invalid JSON",
    };
  }
}

/** @returns {{ type: "empty" } | { type: "invalid"; reason: string } | { type: "database"; updatedAt: number }} */
export function getMcpConfigSource() {
  const p = parseSaved();
  if (p.state === "empty") return { type: "empty" };
  if (p.state === "invalid") {
    return { type: "invalid", reason: p.reason };
  }
  const meta = getMcpConfigMetaFromDb();
  return {
    type: "database",
    updatedAt: meta?.updated_at ?? 0,
  };
}

export function readMcpConfigFile() {
  const p = parseSaved();
  if (p.state !== "ok") return null;
  return p.parsed;
}

/** @param {Record<string, unknown>} def */
export function normalizeStdioServerDef(def) {
  if (!def || typeof def !== "object") return null;
  if (typeof def.command !== "string" || !def.command.trim()) return null;
  return {
    command: def.command.trim(),
    args: Array.isArray(def.args) ? def.args.map(String) : [],
    env:
      def.env && typeof def.env === "object"
        ? Object.fromEntries(
            Object.entries(def.env).map(([k, v]) => [k, String(v)]),
          )
        : {},
    cwd:
      typeof def.cwd === "string" && def.cwd.trim()
        ? def.cwd.trim()
        : undefined,
  };
}

export function getMcpStdioServers() {
  const json = readMcpConfigFile();
  if (!json || typeof json !== "object") return null;

  const block = json.mcpServers ?? json.mcp_servers;
  if (!block || typeof block !== "object") return null;

  const out = {};
  for (const [name, def] of Object.entries(block)) {
    if (!def || typeof def !== "object") continue;
    if (def.disabled === true) continue;
    const norm = normalizeStdioServerDef(def);
    if (!norm) continue;
    out[name] = norm;
  }
  return Object.keys(out).length ? out : null;
}

/**
 * All stdio-capable server rows for UI (includes disabled). Skips malformed entries.
 * @returns {{ name: string; enabled: boolean; def: object }[]}
 */
export function getAllMcpServerRowsForUi() {
  const json = readMcpConfigFile();
  if (!json || typeof json !== "object") return [];

  const block = json.mcpServers ?? json.mcp_servers;
  if (!block || typeof block !== "object") return [];

  const rows = [];
  for (const [name, def] of Object.entries(block)) {
    if (!def || typeof def !== "object") continue;
    const norm = normalizeStdioServerDef(def);
    if (!norm) continue;
    rows.push({
      name,
      enabled: def.disabled !== true,
      def: norm,
    });
  }
  return rows;
}

/** True if saved JSON includes an mcpServers object (even when empty or all disabled). */
export function hasMcpServersSection() {
  const json = readMcpConfigFile();
  if (!json || typeof json !== "object") return false;
  const block = json.mcpServers ?? json.mcp_servers;
  return block != null && typeof block === "object";
}

export function isMcpConfigured() {
  if (process.env.MCP_TOOLS_ENABLED === "0") return false;
  if (getMcpStdioServers()) return true;
  return hasMcpServersSection();
}
