"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Boxes,
  PanelLeft,
  PanelLeftClose,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function ConversationSidebar({
  conversations,
  activeConversationId,
  disabled,
  collapsed,
  onCollapsedChange,
  onSelect,
  onNewChat,
  onDelete,
}) {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      (c.title || "New chat").toLowerCase().includes(q),
    );
  }, [conversations, searchQuery]);

  if (collapsed) {
    return (
      <aside className="flex w-[52px] shrink-0 flex-col items-center gap-1 border-r border-white/[0.08] bg-[#202123] py-3">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-lg text-white/80 hover:bg-white/[0.08] hover:text-white"
          title="Open sidebar"
          onClick={() => onCollapsedChange(false)}
        >
          <PanelLeft className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-lg text-white/80 hover:bg-white/[0.08] hover:text-white"
          disabled={disabled}
          title="New chat"
          onClick={onNewChat}
        >
          <SquarePen className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-lg text-white/80 hover:bg-white/[0.08] hover:text-white"
          title="Search chats"
          onClick={() => onCollapsedChange(false)}
        >
          <Search className="h-5 w-5" />
        </Button>
        <div className="mt-auto flex flex-col pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-lg text-white/80 hover:bg-white/[0.08] hover:text-white"
            title="MCP Servers"
            asChild
          >
            <Link href="/mcp">
              <Boxes className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </aside>
    );
  }

  return (
    <aside
      className={cn(
        "flex w-[260px] shrink-0 flex-col border-r border-white/[0.08] bg-[#202123]",
        "transition-[width] duration-200 ease-out",
      )}
    >
      {/* Brand + collapse */}
      <div className="flex h-[52px] items-center gap-2 px-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15"
          aria-hidden
        >
          <Sparkles className="h-[18px] w-[18px] text-emerald-400" />
        </div>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight text-white/95">
          NIM Chat
        </span>
        <button
          type="button"
          title="Close sidebar"
          disabled={disabled}
          className="rounded-lg p-2 text-white/70 transition-colors hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
          onClick={() => onCollapsedChange(true)}
        >
          <PanelLeftClose className="h-5 w-5" />
        </button>
      </div>

      {/* Primary actions */}
      <div className="flex flex-col gap-2 px-3 pb-3 pt-1">
        <button
          type="button"
          disabled={disabled}
          onClick={onNewChat}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-[13px] font-normal text-white",
            "bg-[#2f2f2f] transition-colors hover:bg-[#3d3d3d]",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          <SquarePen className="h-[18px] w-[18px] shrink-0 text-white/90" />
          New chat
        </button>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35"
            aria-hidden
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search chats"
            autoComplete="off"
            className={cn(
              "w-full rounded-xl border-0 bg-[#2f2f2f] py-3 pl-10 pr-3 text-[13px] text-white placeholder:text-white/35",
              "outline-none ring-0 transition-colors focus:bg-[#353535]",
            )}
          />
        </div>
      </div>

      {/* Recents */}
      <h2 className="px-4 pb-2 pt-2 text-[11px] font-semibold uppercase tracking-wide text-white/45">
        Recents
      </h2>

      <nav className="sidebar-chat-scroll flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-4 pt-0">
        <ul className="flex flex-col gap-0.5">
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-[13px] text-white/35">
              {searchQuery.trim() ? "No chats match." : "No conversations yet."}
            </li>
          ) : (
            filtered.map((c) => {
              const active = c.id === activeConversationId;
              return (
                <li key={c.id}>
                  <div
                    className={cn(
                      "group relative flex items-start rounded-xl transition-colors",
                      active ? "bg-[#2f2f2f]" : "hover:bg-white/[0.06]",
                    )}
                  >
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => onSelect(c.id)}
                      className={cn(
                        "min-w-0 flex-1 rounded-xl px-3 py-3 pr-10 text-left text-[13px] leading-snug text-white/90",
                        active && "text-white",
                      )}
                    >
                      <span className="line-clamp-2">
                        {c.title || "New chat"}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Delete conversation"
                      disabled={disabled}
                      className={cn(
                        "absolute right-2 top-2 rounded-md p-1.5 text-white/45 opacity-0 transition-opacity",
                        "hover:bg-white/[0.08] hover:text-white",
                        "group-hover:opacity-100",
                        active && "opacity-100",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(c.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </nav>

      <div className="shrink-0 border-t border-white/[0.08] px-2 pb-3 pt-2">
        <Link
          href="/mcp"
          className={cn(
            "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] text-white/80",
            "transition-colors hover:bg-white/[0.06] hover:text-white",
          )}
        >
          <Boxes className="h-[18px] w-[18px] shrink-0 text-white/85" />
          MCP Servers
        </Link>
      </div>
    </aside>
  );
}
