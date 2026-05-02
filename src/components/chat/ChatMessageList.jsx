"use client";

import ChatMessage from "@/components/ChatMessage";

export default function ChatMessageList({
  messages,
  showThinking,
  isLoading,
  scrollAnchorRef,
}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {messages.map((message, index) => (
          <ChatMessage
            key={index}
            message={message}
            showThinking={showThinking}
          />
        ))}
        {isLoading && (
          <div className="flex gap-1.5 py-4">
            <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
            <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" />
          </div>
        )}
        <div ref={scrollAnchorRef} />
      </div>
    </div>
  );
}
