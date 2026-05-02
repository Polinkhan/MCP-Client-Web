# MCP Horila HRM (TypeScript)

TypeScript **stdio MCP server** for **Horila HRM** APIs. It is meant to be **registered and run from the NIM Chat UI app** at the root of this repository: that Next.js app spawns this process and passes `env` from the MCP configuration you save in the UI (see below). Any other MCP client that supports the same JSON shape can reuse the same `command` / `args` / `env`.

## Features

**Authentication**

- `hrm_login` — sign in with username and password
- `hrm_set_token` / `hrm_clear_token` — manage Bearer token in-process
- `hrm_auth_state` — inspect current auth state

**Attendance**

- `get_my_today_attendance` / `get_my_todays_attendance` — today’s attendance for the current user
- `hrm_get_absent_employees` — list absent employees

**Dashboard & profile**

- `hrm_get_upcoming_holidays`, `hrm_check_in_status_enabled`, `hrm_get_announcements`, `hrm_get_announcements_by_count`
- `hrm_get_today_dashboard`, `hrm_get_app_dashboard`, `hrm_get_month_wise_attendance`, `hrm_get_employee_profile`

**Leave**

- `hrm_get_available_leaves`, `hrm_get_leave_requests`, `hrm_get_employees_on_leave`, `hrm_get_monthwise_lates`

**Status**

- `hrm_get_employee_status`, `hrm_get_my_status`

## Requirements

- Node.js 20+
- Horila HRM API reachable from the machine running this server
- Either a **Bearer token** or **username/password** for login (see environment variables)

## Install

```bash
npm install
npm run build
```

## Environment Variables

- `HRM_API_BASE_URL` (optional) — API base URL (default: `https://hrm.brotecs.com/api`)
- `HRM_ENDPOINT_LOGIN` (optional) — Login path suffix (default: `/auth/login/`)
- `HRM_API_TOKEN` (optional) — Pre-issued Bearer token; skips password login on startup
- `HRM_API_TOKEN_EXPIRES_AT` (optional) — ISO expiry time for `HRM_API_TOKEN`
- `HRM_API_USERNAME` / `HRM_API_PASSWORD` (optional) — Used for startup login if no `HRM_API_TOKEN`

Provide **`HRM_API_TOKEN`** _or_ both **`HRM_API_USERNAME`** and **`HRM_API_PASSWORD`** so the MCP process can authenticate before the first tool call. You can also use **`hrm_login`** from tools if you prefer interactive login.

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

1. From the **repository root**, install and build this package (`npm install` and `npm run build` in `mcp-servers/hrm`).
2. Start the web app (`yarn dev` or `yarn start` after `yarn build`).
3. Open **`/mcp`** in the browser → **Edit Json**.
4. Paste or merge a top-level **`mcpServers`** object. Use an **absolute** path to **`dist/mcp/server.js`** on the machine where the Next.js server runs (that process starts the MCP child).

Example (password login on startup):

```json
{
  "mcpServers": {
    "hrm-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/hrm/dist/mcp/server.js"],
      "env": {
        "HRM_API_BASE_URL": "https://your-hrm.example.com/api",
        "HRM_API_USERNAME": "user",
        "HRM_API_PASSWORD": "secret"
      }
    }
  }
}
```

Example using a token instead of password login:

```json
{
  "mcpServers": {
    "hrm-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-servers/hrm/dist/mcp/server.js"],
      "env": {
        "HRM_API_BASE_URL": "https://your-hrm.example.com/api",
        "HRM_API_TOKEN": "your-jwt-or-access-token"
      }
    }
  }
}
```

Save in the UI so the config is stored in the app database. Enable the server on the **MCP Servers** tab if needed.
