import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import McpToolSteps from "@/components/chat/McpToolSteps";
import { Button } from "./ui/button";
import {
  ThumbsUp,
  ThumbsDown,
  Upload,
  RefreshCw,
  MoreVertical,
} from "lucide-react";

function ChatMessage({ message, showThinking }) {
  const isUser = message.role === "user";
  const hasThinking = message.thinking && message.thinking.trim().length > 0;

  return (
    <div className={`group ${isUser ? "" : ""}`}>
      <div
        className={`flex gap-4 ${
          isUser ? "flex-row" : "flex-row-reverse justify-end"
        } max-w-3xl ${isUser ? "" : "ml-auto"}`}
      >
        {/* Message Content */}
        <div
          className={`flex-1 min-w-0 py-4 flex flex-col ${
            isUser ? "items-end" : ""
          }`}
        >
          {isUser ? (
            <div className="bg-[#303030] rounded-[18px] px-4 pb-1.5 pt-2 inline-block">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>
            </div>
          ) : (
            <>
              <McpToolSteps toolSteps={message.toolSteps} />
              {hasThinking && showThinking && (
                <div className="mb-4 p-4 border-l-4 border-l-gray-600 rounded-md">
                  <div className="text-xs font-semibold uppercase tracking-wider mb-2 text-gray-400">
                    Thinking:
                  </div>
                  <div className="text-[13px] italic text-gray-400">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code: ({
                          node,
                          inline,
                          className,
                          children,
                          ...props
                        }) => {
                          const match = /language-(\w+)/.exec(className || "");
                          return !inline && match ? (
                            <pre className="bg-background/50 border rounded-md p-4 overflow-x-auto my-2">
                              <code className={className} {...props}>
                                {children}
                              </code>
                            </pre>
                          ) : (
                            <code
                              className="bg-background/50 px-1.5 py-0.5 rounded text-xs font-mono"
                              {...props}
                            >
                              {children}
                            </code>
                          );
                        },
                        p: ({ children }) => (
                          <p className="mb-2 last:mb-0">{children}</p>
                        ),
                      }}
                    >
                      {message.thinking}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none bg-transparent text-white">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: ({ node, inline, className, children, ...props }) => {
                      const match = /language-(\w+)/.exec(className || "");
                      return !inline && match ? (
                        <pre className="bg-muted border rounded-md p-4 overflow-x-auto my-4">
                          <code className="text-sm font-mono" {...props}>
                            {children}
                          </code>
                        </pre>
                      ) : (
                        <code
                          className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </>
          )}

          {/* Action Buttons */}
          {!isUser && (
            <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ThumbsUp className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ThumbsDown className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <Upload className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
