"use client";

import Link from "next/link";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Boxes, ChevronDown, PanelLeft } from "lucide-react";

export default function ChatHeader({
  title,
  showThinking,
  onShowThinkingChange,
  sidebarCollapsed,
  onOpenSidebar,
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex min-w-0 items-center gap-1">
        {sidebarCollapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-white/80 hover:bg-white/[0.08] hover:text-white"
            title="Open sidebar"
            onClick={onOpenSidebar}
          >
            <PanelLeft className="h-5 w-5" />
          </Button>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="gap-1">
              {title}
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="show-thinking-header"
                  checked={showThinking}
                  onCheckedChange={onShowThinkingChange}
                />
                <label
                  htmlFor="show-thinking-header"
                  className="text-sm cursor-pointer"
                >
                  Show Thinking
                </label>
              </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/mcp" className="flex cursor-pointer items-center gap-2">
                <Boxes className="h-4 w-4" />
                MCP servers
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
