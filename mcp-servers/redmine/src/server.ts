import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import yaml from "js-yaml";
import fs from "node:fs/promises";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const OPENAPI_SOURCES = [
  "https://raw.githubusercontent.com/d-yoshi/redmine-openapi/refs/heads/main/openapi.yml",
  "https://raw.githubusercontent.com/d-yoshi/redmine-openapi/refs/heads/main/openapi.yaml",
  "https://raw.githubusercontent.com/d-yoshi/redmine-openapi/refs/heads/main/openapi.json",
];

const baseUrl = mustGetEnv("REDMINE_URL").replace(/\/+$/, "");
const apiKey = mustGetEnv("REDMINE_API_KEY");
const responseFormat =
  (process.env.REDMINE_RESPONSE_FORMAT || "yaml").toLowerCase() === "json" ? "json" : "yaml";
const additionalHeaders = parseHeaders(process.env.REDMINE_HEADERS || "");
const allowedDirectories = parseAllowedDirectories(process.env.REDMINE_ALLOWED_DIRECTORIES || "");
const requestInstructionsPath = process.env.REDMINE_REQUEST_INSTRUCTIONS?.trim();

if (process.env.REDMINE_DANGEROUSLY_ACCEPT_INVALID_CERTS === "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const server = new McpServer({
  name: "mcp-redmine-typescript",
  version: "0.1.0",
});

let openApiCache: Record<string, unknown> | null = null;
let requestInstructionsCache: string | null = null;

server.tool(
  "redmine_paths_list",
  "List all Redmine API path templates from OpenAPI spec",
  {},
  async () => {
    const spec = await getOpenApiSpec();
    const paths = Object.keys((spec.paths ?? {}) as Record<string, unknown>).sort();
    return textResult(serialize(paths));
  },
);

server.tool(
  "redmine_paths_info",
  "Get detailed OpenAPI definitions for selected path templates",
  {
    path_templates: z.array(z.string()).min(1),
  },
  async ({ path_templates }) => {
    const spec = await getOpenApiSpec();
    const paths = (spec.paths ?? {}) as Record<string, unknown>;
    const selected: Record<string, unknown> = {};

    for (const template of path_templates) {
      if (template in paths) {
        selected[template] = paths[template];
      }
    }

    return textResult(serialize(selected));
  },
);

server.tool(
  "redmine_request",
  "Send direct request to Redmine API",
  {
    path: z.string().min(1),
    method: z.string().optional().default("get"),
    data: z.record(z.string(), z.unknown()).optional(),
    params: z.record(z.string(), z.unknown()).optional(),
  },
  async ({ path: apiPath, method, data, params }) => {
    const instructions = await getRequestInstructions();
    const result = await redmineRequest({
      apiPath,
      method,
      data,
      params,
      includeInstructions: instructions,
    });
    return textResult(serialize(result));
  },
);

server.tool(
  "redmine_upload",
  "Upload a file to Redmine and return upload token",
  {
    file_path: z.string().min(1),
    description: z.string().optional(),
  },
  async ({ file_path, description }) => {
    assertFileOpsEnabled();
    const safePath = resolveAllowedPath(file_path);
    const fileContent = await fs.readFile(safePath);
    const filename = path.basename(safePath);
    const query = new URLSearchParams({ filename });
    if (description) {
      query.set("description", description);
    }

    const response = await fetch(`${baseUrl}/uploads.json?${query.toString()}`, {
      method: "POST",
      headers: {
        "X-Redmine-API-Key": apiKey,
        "Content-Type": "application/octet-stream",
        ...additionalHeaders,
      },
      body: fileContent,
    });

    return textResult(
      serialize({
        status_code: response.status,
        body: await tryJson(response),
        error: response.ok ? "" : await safeText(response),
      }),
    );
  },
);

server.tool(
  "redmine_download",
  "Download Redmine attachment into allowed directory",
  {
    attachment_id: z.number().int().positive(),
    save_path: z.string().min(1),
    filename: z.string().optional(),
  },
  async ({ attachment_id, save_path, filename }) => {
    assertFileOpsEnabled();
    const baseSavePath = resolveAllowedPath(save_path);
    const response = await fetch(`${baseUrl}/attachments/download/${attachment_id}`, {
      method: "GET",
      headers: {
        "X-Redmine-API-Key": apiKey,
        ...additionalHeaders,
      },
    });

    if (!response.ok) {
      return textResult(
        serialize({
          status_code: response.status,
          body: {},
          error: await safeText(response),
        }),
      );
    }

    const detectedName =
      extractFilename(response.headers.get("content-disposition")) || `${attachment_id}`;
    const outputPath = filename
      ? resolveAllowedPath(path.join(path.dirname(baseSavePath), filename))
      : baseSavePath;
    const outputFilename = filename || path.basename(outputPath) || detectedName;
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    const bytes = Buffer.from(await response.arrayBuffer());
    await fs.writeFile(outputPath, bytes);

    return textResult(
      serialize({
        status_code: response.status,
        body: {
          saved_to: outputPath,
          filename: outputFilename,
        },
        error: "",
      }),
    );
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);

function mustGetEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function parseHeaders(raw: string): Record<string, string> {
  if (!raw.trim()) return {};
  const headers: Record<string, string> = {};
  for (const item of raw.split(",")) {
    const idx = item.indexOf(":");
    if (idx <= 0) continue;
    const key = item.slice(0, idx).trim();
    const value = item.slice(idx + 1).trim();
    if (key && value) headers[key] = value;
  }
  return headers;
}

function parseAllowedDirectories(raw: string): string[] {
  return raw
    .split(",")
    .map((dir) => dir.trim())
    .filter(Boolean)
    .map((dir) => path.resolve(dir));
}

function assertFileOpsEnabled(): void {
  if (allowedDirectories.length === 0) {
    throw new Error("REDMINE_ALLOWED_DIRECTORIES must be set for file operations");
  }
}

function resolveAllowedPath(candidatePath: string): string {
  const absolutePath = path.resolve(candidatePath);
  if (
    !allowedDirectories.some(
      (allowedDir) =>
        absolutePath === allowedDir || absolutePath.startsWith(`${allowedDir}${path.sep}`),
    )
  ) {
    throw new Error(`Path is not allowed: ${candidatePath}`);
  }
  return absolutePath;
}

async function getOpenApiSpec(): Promise<Record<string, unknown>> {
  if (openApiCache) return openApiCache;
  for (const source of OPENAPI_SOURCES) {
    const response = await fetch(source);
    if (!response.ok) continue;
    const text = await response.text();
    const loaded = source.endsWith(".json") ? JSON.parse(text) : yaml.load(text);
    if (loaded && typeof loaded === "object") {
      openApiCache = loaded as Record<string, unknown>;
      return openApiCache;
    }
  }
  throw new Error("Unable to load Redmine OpenAPI spec from known sources");
}

async function getRequestInstructions(): Promise<string | null> {
  if (!requestInstructionsPath) return null;
  if (requestInstructionsCache !== null) return requestInstructionsCache;
  try {
    requestInstructionsCache = (await fs.readFile(requestInstructionsPath, "utf8")).trim();
  } catch {
    requestInstructionsCache = "";
  }
  return requestInstructionsCache || null;
}

async function redmineRequest(input: {
  apiPath: string;
  method: string;
  data?: Record<string, unknown>;
  params?: Record<string, unknown>;
  includeInstructions?: string | null;
}): Promise<{ status_code: number; body: JsonValue; error: string }> {
  const url = new URL(`${baseUrl}${normalizeApiPath(input.apiPath)}`);
  for (const [key, value] of Object.entries(input.params || {})) {
    if (value === undefined || value === null) continue;
    url.searchParams.set(key, String(value));
  }

  const headers: Record<string, string> = {
    "X-Redmine-API-Key": apiKey,
    ...additionalHeaders,
  };
  let body: string | undefined;
  if (input.data && Object.keys(input.data).length > 0) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(input.data);
  }
  if (input.includeInstructions) {
    headers["X-MCP-Redmine-Instructions"] = input.includeInstructions;
  }

  const response = await fetch(url, {
    method: input.method.toUpperCase(),
    headers,
    body,
  });

  return {
    status_code: response.status,
    body: await tryJson(response),
    error: response.ok ? "" : await safeText(response),
  };
}

function normalizeApiPath(apiPath: string): string {
  if (apiPath.startsWith("/")) return apiPath;
  return `/${apiPath}`;
}

async function tryJson(response: Response): Promise<JsonValue> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || "";
  if (!contentType.includes("application/json")) {
    const text = await safeText(response);
    return text as JsonValue;
  }
  try {
    const parsed = (await response.json()) as JsonValue;
    return parsed;
  } catch {
    return (await safeText(response)) as JsonValue;
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).trim();
  } catch {
    return "";
  }
}

function extractFilename(contentDisposition: string | null): string | null {
  if (!contentDisposition) return null;
  const match = /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/.exec(contentDisposition);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

function serialize(data: unknown): string {
  return responseFormat === "json"
    ? JSON.stringify(data, null, 2)
    : yaml.dump(data, { noRefs: true, lineWidth: 120 });
}

function textResult(text: string): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text }],
  };
}
