"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import McpJsonEditor from "@/components/mcp/McpJsonEditor";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { FileJson2, LayoutGrid, Loader2 } from "lucide-react";

export default function McpPage() {
  const searchParams = useSearchParams();
  const initialTab =
    searchParams.get("tab") === "edit" ? "edit" : "servers";

  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reloadBusy, setReloadBusy] = useState(false);

  const [jsonText, setJsonText] = useState("");
  const [configMeta, setConfigMeta] = useState(null);
  const [editorLoading, setEditorLoading] = useState(true);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [toggleBusy, setToggleBusy] = useState(null);

  const loadServers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/mcp/servers");
      setData(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  const loadConfig = useCallback(async () => {
    setEditorLoading(true);
    try {
      const r = await fetch("/api/mcp/config");
      const j = await r.json();
      setJsonText(typeof j.json === "string" ? j.json : "");
      setConfigMeta({
        source: j.source,
        updatedAt: j.updatedAt,
        invalidReason: j.invalidReason,
      });
    } finally {
      setEditorLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  useEffect(() => {
    if (tab === "edit") {
      loadConfig();
    }
  }, [tab, loadConfig]);

  async function reloadClients() {
    setReloadBusy(true);
    try {
      await fetch("/api/mcp/reload", { method: "POST" });
      await loadServers();
    } finally {
      setReloadBusy(false);
    }
  }

  async function toggleServer(serverName, enabled) {
    setToggleBusy(serverName);
    try {
      const r = await fetch(
        `/api/mcp/servers/${encodeURIComponent(serverName)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enabled }),
        },
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSaveMessage(j.error || `Toggle failed (${r.status})`);
        return;
      }
      await loadServers();
    } finally {
      setToggleBusy(null);
    }
  }

  async function saveJson() {
    setSaveBusy(true);
    setSaveMessage("");
    try {
      const r = await fetch("/api/mcp/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json: jsonText }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSaveMessage(j.error || `Save failed (${r.status})`);
        return;
      }
      setSaveMessage("Saved to database. MCP clients reloaded.");
      setConfigMeta({
        source: "database",
        updatedAt: j.updatedAt,
        invalidReason: undefined,
      });
      await loadServers();
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="flex h-screen min-h-0 bg-[#212121] text-[#ececec]">
      <aside className="flex w-[220px] shrink-0 flex-col border-r border-white/[0.08] bg-[#202123] px-3 py-4">
        <Link
          href="/"
          className="mb-6 text-[13px] text-white/60 transition-colors hover:text-white"
        >
          ← Back to chat
        </Link>
        <nav className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => setTab("servers")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors",
              tab === "servers"
                ? "bg-white/[0.1] text-white"
                : "text-white/70 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <LayoutGrid className="h-[18px] w-[18px] shrink-0 opacity-90" />
            MCP Servers
          </button>
          <button
            type="button"
            onClick={() => setTab("edit")}
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition-colors",
              tab === "edit"
                ? "bg-white/[0.1] text-white"
                : "text-white/70 hover:bg-white/[0.06] hover:text-white",
            )}
          >
            <FileJson2 className="h-[18px] w-[18px] shrink-0 opacity-90" />
            Edit Json
          </button>
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {tab === "servers" ? (
          <>
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
              <div>
                <h1 className="text-xl font-semibold text-white">
                  MCP servers
                </h1>
                <p className="mt-1 text-sm text-white/55">
                  Active config:{" "}
                  <span className="text-white/80">
                    {data?.configSource === "database"
                      ? "database (saved)"
                      : data?.configSource === "invalid"
                        ? "invalid JSON — fix in Edit Json"
                        : "empty (nothing saved yet)"}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={reloadBusy}
                  onClick={reloadClients}
                  className="border-white/20 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                >
                  {reloadBusy ? "Reloading…" : "Disconnect & reload"}
                </Button>
              </div>
            </header>

            <div className="sidebar-chat-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {loading && !data ? (
                <p className="text-sm text-white/50">Loading…</p>
              ) : null}

              {data && !data.configured ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100/90">
                  {data.message}
                </div>
              ) : null}

              {data?.configured && !data?.readable ? (
                <div className="rounded-lg border border-red-500/25 bg-red-500/10 p-4 text-sm text-red-100/90">
                  {data.message}
                </div>
              ) : null}

              {data?.readable ? (
                <>
                  <ul className="mx-auto flex max-w-3xl flex-col gap-4">
                    {(data.servers ?? []).map((s) => (
                      <li
                        key={s.name}
                        className="rounded-lg border border-white/[0.08] bg-[#2a2a2a] p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span className="font-medium text-white">
                            {s.name}
                          </span>
                          <div className="flex flex-wrap items-center gap-3">
                            <span
                              className={
                                s.status === "disabled"
                                  ? "text-xs text-white/45"
                                  : s.status === "connected"
                                    ? "text-xs text-emerald-400/90"
                                    : "text-xs text-red-400/90"
                              }
                            >
                              {s.status === "disabled"
                                ? "Off"
                                : s.status === "connected"
                                  ? "Connected"
                                  : "Error"}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] text-white/50">
                                Enable
                              </span>
                              <Switch
                                checked={s.enabled !== false}
                                disabled={toggleBusy === s.name}
                                onCheckedChange={(on) =>
                                  toggleServer(s.name, on)
                                }
                                aria-label={`Enable ${s.name}`}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="mt-2 font-mono text-xs text-white/70">
                          <span>{s.command}</span>
                          {(s.args ?? []).length ? (
                            <span className="text-white/50">
                              {" "}
                              {(s.args ?? []).join(" ")}
                            </span>
                          ) : null}
                        </div>
                        {s.cwd ? (
                          <div className="mt-1 text-xs text-white/45">
                            cwd:{" "}
                            <span className="font-mono">{s.cwd}</span>
                          </div>
                        ) : null}
                        {(s.envKeys ?? []).length ? (
                          <div className="mt-2 text-xs text-white/50">
                            env keys: {(s.envKeys ?? []).join(", ")} (values
                            hidden in UI)
                          </div>
                        ) : null}
                        {s.status === "error" && s.error ? (
                          <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded bg-black/30 p-2 text-xs text-red-200/90">
                            {s.error}
                          </pre>
                        ) : null}
                        {s.status === "disabled" ? (
                          <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/45">
                            Server is off — enable to connect and list tools.
                          </p>
                        ) : (s.tools ?? []).length ? (
                          <ul className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
                            {(s.tools ?? []).map((t) => (
                              <li
                                key={t.name}
                                className="rounded bg-white/[0.06] px-2 py-1 text-xs text-white/85"
                                title={t.description || undefined}
                              >
                                {t.name}
                              </li>
                            ))}
                          </ul>
                        ) : s.status === "connected" ? (
                          <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs text-white/45">
                            No tools listed.
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>

                  {(data.servers ?? []).length === 0 ? (
                    <p className="mx-auto max-w-3xl text-sm text-white/45">
                      No stdio MCP servers in config. Use Edit Json to add
                      servers.
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 border-b border-white/[0.08] px-6 py-5">
              <div>
                <h1 className="text-xl font-semibold text-white">
                  Edit MCP JSON
                </h1>
                <p className="mt-1 max-w-xl text-sm text-white/55">
                  Stored in SQLite (
                  <code className="rounded bg-white/10 px-1 text-xs">mcp_config</code>
                  ). Saving reloads MCP connections. Default when empty:{" "}
                  <code className="rounded bg-white/10 px-1 text-xs">
                    {'{ "mcpServers": {} }'}
                  </code>
                  .
                </p>
                {configMeta ? (
                  <p className="mt-2 text-xs text-white/45">
                    {configMeta.source === "invalid" && configMeta.invalidReason ? (
                      <span className="text-amber-200/90">
                        Invalid JSON: {configMeta.invalidReason}
                      </span>
                    ) : (
                      <>
                        Source:{" "}
                        <span className="text-white/70">
                          {configMeta.source === "database"
                            ? "database"
                            : configMeta.source === "empty"
                              ? "empty (template shown)"
                              : configMeta.source}
                        </span>
                        {configMeta.updatedAt ? (
                          <span className="ml-2">
                            · updated{" "}
                            {new Date(configMeta.updatedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </>
                    )}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {saveMessage ? (
                  <span
                    className={cn(
                      "text-sm",
                      saveMessage.startsWith("Saved")
                        ? "text-emerald-400/90"
                        : "text-red-400/90",
                    )}
                  >
                    {saveMessage}
                  </span>
                ) : null}
                <Button
                  size="sm"
                  disabled={saveBusy || editorLoading}
                  onClick={saveJson}
                  className="bg-emerald-600 text-white hover:bg-emerald-500"
                >
                  {saveBusy ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Save to database"
                  )}
                </Button>
              </div>
            </header>

            <div className="relative min-h-0 flex-1 px-6 pb-6 pt-4">
              {editorLoading ? (
                <div className="flex h-[calc(100vh-12rem)] items-center justify-center text-white/45">
                  Loading editor…
                </div>
              ) : (
                <div className="h-[calc(100vh-12rem)] min-h-[320px] overflow-hidden rounded-lg border border-white/[0.1]">
                  <McpJsonEditor value={jsonText} onChange={setJsonText} />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
