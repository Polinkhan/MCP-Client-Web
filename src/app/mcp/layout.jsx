import { Suspense } from "react";

export default function McpLayout({ children }) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#212121] text-white/50">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
