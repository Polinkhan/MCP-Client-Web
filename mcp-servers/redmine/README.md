# MCP Redmine (TypeScript)

TypeScript MCP server for Redmine, designed for Cursor and other MCP-compatible clients.

## Features

- `redmine_paths_list` - list available API paths from Redmine OpenAPI spec
- `redmine_paths_info` - inspect detailed OpenAPI schema for selected paths
- `redmine_request` - perform direct Redmine API requests
- `redmine_upload` - upload files and get Redmine upload token
- `redmine_download` - download attachments to local disk

## Requirements

- Node.js 20+
- Redmine URL and API key

## Install

```bash
npm install
npm run build
```

## Environment Variables

- `REDMINE_URL` (required) - Redmine base URL (supports subpaths)
- `REDMINE_API_KEY` (required) - Redmine API key
- `REDMINE_REQUEST_INSTRUCTIONS` (optional) - path to request guidance file
- `REDMINE_HEADERS` (optional) - extra headers, example: `Header1: A, Header2: B`
- `REDMINE_RESPONSE_FORMAT` (optional) - `yaml` (default) or `json`
- `REDMINE_ALLOWED_DIRECTORIES` (required for upload/download) - comma-separated safe directories
- `REDMINE_DANGEROUSLY_ACCEPT_INVALID_CERTS` (optional) - set `1` to disable TLS cert validation

## Run

```bash
npm run dev
```

or production:

```bash
npm run build
npm start
```

## Cursor MCP Config

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "redmine-ts": {
      "command": "node",
      "args": ["/absolute/path/to/Redmine MCP/dist/server.js"],
      "env": {
        "REDMINE_URL": "https://your-redmine.example.com",
        "REDMINE_API_KEY": "your-api-key",
        "REDMINE_RESPONSE_FORMAT": "yaml",
        "REDMINE_ALLOWED_DIRECTORIES": "/tmp,/home/user/uploads"
      }
    }
  }
}
```
