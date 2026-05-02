"use client";

import { useState } from "react";
import ChatInput from "@/components/ChatInput";
import { useChatSession } from "@/hooks/useChatSession";
import ChatHeader from "@/components/chat/ChatHeader";
import ChatMessageList from "@/components/chat/ChatMessageList";
import ConversationSidebar from "@/components/chat/ConversationSidebar";

export default function ChatApp() {
  const chat = useChatSession();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!chat.ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#212121] text-muted-foreground">
        Loading conversations…
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#212121]">
      <ConversationSidebar
        conversations={chat.conversations}
        activeConversationId={chat.conversationId}
        disabled={chat.isLoading}
        collapsed={sidebarCollapsed}
        onCollapsedChange={setSidebarCollapsed}
        onSelect={chat.selectConversation}
        onNewChat={chat.createConversation}
        onDelete={chat.deleteConversation}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        <ChatHeader
          title={chat.headerTitle}
          showThinking={chat.showThinking}
          onShowThinkingChange={chat.setShowThinking}
          sidebarCollapsed={sidebarCollapsed}
          onOpenSidebar={() => setSidebarCollapsed(false)}
        />

        <ChatMessageList
          messages={chat.messages}
          showThinking={chat.showThinking}
          isLoading={chat.isLoading}
          scrollAnchorRef={chat.messagesEndRef}
        />

        <ChatInput
          onSendMessage={chat.sendMessage}
          isLoading={chat.isLoading}
          onStop={chat.stopGeneration}
          thinkingMode={chat.thinkingMode}
          onThinkingModeChange={chat.setThinkingMode}
        />
      </div>
    </div>
  );
}
