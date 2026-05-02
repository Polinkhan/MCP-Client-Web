import { useState, useRef, useEffect } from "react";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Textarea } from "./ui/textarea";
import { Mic, Radio } from "lucide-react";

function ChatInput({
  onSendMessage,
  isLoading,
  onStop,
  thinkingMode,
  onThinkingModeChange,
}) {
  const [input, setInput] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  useEffect(() => {
    if (!isLoading && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.select();
    }
  }, [isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input, undefined, thinkingMode);
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="border-t border-border bg-[#212121]">
      <div className="max-w-3xl mx-auto px-4 py-4">
        {/* Thinking Mode Toggle - Hidden by default, can be shown in settings */}
        <div className="flex justify-end mb-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="thinking-mode"
              checked={thinkingMode}
              onCheckedChange={onThinkingModeChange}
              disabled={isLoading}
            />
            <label
              htmlFor="thinking-mode"
              className="text-xs text-muted-foreground cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {thinkingMode ? "Thinking" : "Direct"}
            </label>
          </div>
        </div>

        {/* Input Field */}
        <form onSubmit={handleSubmit} className="relative">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything..."
              rows={1}
              className="resize-none border-0 bg-[#303030] rounded-[18px] shadow-sm focus-visible:ring-0 min-h-[32px] max-h-[200px] pr-20 pl-6 text-base py-4"
              disabled={isLoading}
            />
            <div className="absolute top-1/2 -translate-y-1/2 right-2 flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Voice input"
              >
                <Mic className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title="Voice input"
              >
                <Radio className="h-4 w-4" />
              </Button>
              {input.trim() && !isLoading && (
                <Button
                  type="submit"
                  size="icon"
                  className="h-8 w-8 bg-white hover:bg-white/90 text-black rounded-full"
                  disabled={!input.trim()}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M.5 1.163L1.853.5l13.647 7.5-13.647 7.5L.5 14.837V8.87l8.5-1.24V8.37l-8.5-1.24V1.163z"
                      fill="currentColor"
                    />
                  </svg>
                </Button>
              )}
            </div>
          </div>
        </form>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground text-center mt-2">
          NVIDIA NIM models can make mistakes. Check important info.
        </p>
      </div>
    </div>
  );
}

export default ChatInput;
