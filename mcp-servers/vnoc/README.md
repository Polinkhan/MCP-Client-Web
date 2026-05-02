# MCP vNOC (TypeScript)

TypeScript **stdio MCP server** for **vNOC** (JSON-RPC style API similar to Zabbix), plus optional **Elasticsearch** helpers for indices, thresholds, and aggregations. It is meant to be **registered and run from the NIM Chat UI app** at the root of this repository: that Next.js app spawns this process and passes `env` from the MCP configuration you save in the UI. Other MCP clients that support the same JSON shape can reuse the same `command` / `args` / `env`.

## Features

**API**

- `vnoc_get_api_version` — connectivity check against the vNOC API

**Hosts**

- `vnoc_get_hosts` — list hosts (optional `limit`)
- `vnoc_check_hosts_online` — classify hosts as online / offline / unknown from recent item data

**Metrics**

- `vnoc_query_metric` — natural-language style metric lookup for a host (CPU, memory, disk, etc.)

**Elasticsearch** (requires `ELASTICSEARCH_URL`)

- `vnoc_elasticsearch_discover` — list indices and sample mappings
- `vnoc_elasticsearch_query_threshold` — threshold-oriented queries
- `vnoc_query_hosts_by_metric_threshold` — find hosts crossing metric thresholds
- `vnoc_elasticsearch_aggregate` — aggregation queries

## Requirements

- Node.js 20+
- vNOC API URL and **Bearer token** (`Authorization` header)
- Optional: Elasticsearch URL (and basic auth if your cluster uses it) for ES-backed tools

## Install

```bash
npm install
npm run build
```

## Environment Variables

- `VNOC_API_BASE_URL` (required) — vNOC origin (e.g. `https://vnoc.example.com`); the client calls `{base}/api_jsonrpc.php`
- `VNOC_API_TOKEN` (required) — Bearer token for `Authorization` on JSON-RPC requests
- `ELASTICSEARCH_URL` (optional) — Elasticsearch base URL; required for `vnoc_elasticsearch_*` tools
- `ELASTICSEARCH_USERNAME` / `ELASTICSEARCH_PASSWORD` (optional) — Basic auth for Elasticsearch

## Run

Stdio MCP (not the sample Express app in `src/server.ts`):

Development (watch):

```bash
npm run mcp:dev
```

Production (after `npm run build`):

```bash
npm run mcp
```

The MCP entry file is **`dist/mcp/server.js`**.

## Register in NIM Chat UI

1. From the **repository root**, install and build this package (`npm install` and `npm run build` in `mcp-servers/vnoc`).
2. Start the web app (`yarn dev` or `yarn start` after `yarn build`).
3. Open **`/mcp`** → **Edit Json**.
4. Add a **`mcpServers`** entry with an **absolute** path to **`dist/mcp/server.js`** on the host that runs the Next.js server.

```json
{
  "mcpServers": {
    "vnoc-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/vnoc/dist/mcp/server.js"],
      "env": {
        "VNOC_API_BASE_URL": "https://your-vnoc.example.com",
        "VNOC_API_TOKEN": "your-bearer-token",
        "ELASTICSEARCH_URL": "https://your-elasticsearch.example.com:9200",
        "ELASTICSEARCH_USERNAME": "elastic",
        "ELASTICSEARCH_PASSWORD": "secret"
      }
    }
  }
}
```

If you only need vNOC API tools (no Elasticsearch), omit `ELASTICSEARCH_*` variables; ES tools will fail until a URL is configured.

Save in the UI so the config is stored in the app database. Enable the server on the **MCP Servers** tab if needed.
