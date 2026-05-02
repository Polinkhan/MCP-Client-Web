"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";

/**
 * @param {{ toolSteps?: Array<{ id: string; server: string; tool: string; status: string; error?: string }> }} props
 */
export default function McpToolSteps({ toolSteps }) {
  if (!toolSteps?.length) return null;

  return (
    <div className="mb-3 rounded-lg border border-white/[0.1] bg-[#2a2a2a]/90 px-3 py-2 text-left">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/45">
        Tools
      </div>
      <ul className="flex flex-col gap-1.5">
        {toolSteps.map((step) => (
          <li
            key={step.id}
            className="flex items-start gap-2 text-xs text-white/85"
          >
            <span className="mt-0.5 shrink-0">
              {step.status === "pending" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-400" aria-hidden />
              ) : step.status === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" aria-hidden />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-400" aria-hidden />
              )}
            </span>
            <span className="min-w-0 break-all">
              <span className="font-mono text-white/55">{step.server}</span>
              <span className="text-white/35"> · </span>
              <span className="font-mono text-white/90">{step.tool}</span>
              {step.status === "error" && step.error ? (
                <span className="mt-0.5 block text-[11px] text-red-300/90">
                  {step.error}
                </span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
