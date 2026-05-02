"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { postChatProxy } from "@/lib/chat/request-chat";
import { consumeNimStream } from "@/lib/chat/consume-nim-stream";
import { buildApiMessagesForRequest } from "@/lib/chat/build-api-messages";

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  return res.json();
}

export function useChatSession() {
  const [ready, setReady] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showThinking, setShowThinking] = useState(true);
  const [thinkingMode, setThinkingMode] = useState(true);

  const messagesEndRef = useRef(null);
  const abortControllerRef = useRef(null);
  const accumulatedContentRef = useRef("");
  const accumulatedThinkingRef = useRef("");
  const accumulatedToolStepsRef = useRef([]);
  const conversationIdRef = useRef(null);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const refreshConversations = useCallback(async () => {
    const list = await fetch("/api/conversations").then((r) => r.json());
    if (Array.isArray(list)) setConversations(list);
  }, []);

  const loadConversation = useCallback(async (id) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversationId(id);
      setMessages(
      (data.messages ?? []).map((m) => ({
        role: m.role,
        content: m.content ?? "",
        thinking: m.thinking ?? "",
        toolSteps: [],
      })),
    );
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let list = await fetch("/api/conversations").then((r) => r.json());
        if (!Array.isArray(list)) list = [];
        if (list.length === 0) {
          await fetch("/api/conversations", { method: "POST" });
          list = await fetch("/api/conversations").then((r) => r.json());
        }
        if (cancelled || !Array.isArray(list) || list.length === 0) return;

        setConversations(list);
        const firstId = list[0].id;
        const detail = await fetchJson(`/api/conversations/${firstId}`);
        if (cancelled) return;
        setConversationId(firstId);
        setMessages(
          (detail.messages ?? []).map((m) => ({
            role: m.role,
            content: m.content ?? "",
            thinking: m.thinking ?? "",
            toolSteps: [],
          })),
        );
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const st = localStorage.getItem("showThinking");
      if (st !== null) setShowThinking(JSON.parse(st));
      const tm = localStorage.getItem("thinkingMode");
      if (tm !== null) setThinkingMode(JSON.parse(tm));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem("showThinking", JSON.stringify(showThinking));
  }, [showThinking]);

  useEffect(() => {
    localStorage.setItem("thinkingMode", JSON.stringify(thinkingMode));
  }, [thinkingMode]);

  const pushAssistantUpdate = useCallback(() => {
    setMessages((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last?.role === "assistant") {
        next[next.length - 1] = {
          ...last,
          content: accumulatedContentRef.current,
          thinking: accumulatedThinkingRef.current,
          toolSteps: [...accumulatedToolStepsRef.current],
        };
      }
      return next;
    });
  }, []);

  const streamViaProxy = useCallback(
    async (apiMessages, signal, thinkingMode) => {
      const response = await postChatProxy(apiMessages, signal, thinkingMode);
      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(
          errText
            ? `HTTP ${response.status}: ${errText.slice(0, 200)}`
            : `HTTP error! status: ${response.status}`,
        );
      }

      await consumeNimStream(response, {
        contentRef: accumulatedContentRef,
        thinkingRef: accumulatedThinkingRef,
        toolStepsRef: accumulatedToolStepsRef,
        onPartialUpdate: pushAssistantUpdate,
        setLoadingFalse: () => setIsLoading(false),
      });
    },
    [pushAssistantUpdate],
  );

  const persistAssistant = useCallback(async (cid, content, thinking) => {
    await fetch(`/api/conversations/${cid}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: "assistant",
        content,
        thinking: thinking ?? "",
      }),
    });
    await refreshConversations();
  }, [refreshConversations]);

  const sendMessage = useCallback(
    async (input, _modelUnused, thinkingToggle) => {
      const cid = conversationIdRef.current;
      if (!cid || !input.trim() || isLoading) return;

      const trimmed = input.trim();
      const priorUserCount = messages.filter((m) => m.role === "user").length;

      await fetch(`/api/conversations/${cid}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: "user", content: trimmed }),
      });

      if (priorUserCount === 0) {
        const title = trimmed.slice(0, 48);
        await fetch(`/api/conversations/${cid}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "New chat" }),
        });
        await refreshConversations();
      }

      const apiMessages = buildApiMessagesForRequest(messages, trimmed);
      if (apiMessages.length === 0) return;

      setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
      setIsLoading(true);

      abortControllerRef.current = new AbortController();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", thinking: "", toolSteps: [] },
      ]);
      accumulatedContentRef.current = "";
      accumulatedThinkingRef.current = "";
      accumulatedToolStepsRef.current = [];

      const signal = abortControllerRef.current.signal;

      try {
        const mode =
          typeof thinkingToggle === "boolean" ? thinkingToggle : thinkingMode;
        await streamViaProxy(apiMessages, signal, mode);
        await persistAssistant(
          cid,
          accumulatedContentRef.current,
          accumulatedThinkingRef.current,
        );
      } catch (error) {
        if (error.name === "AbortError") {
          console.log("Request aborted");
        } else {
          console.error("Error:", error);
          const errText = `${error.message} Ensure NIM_CHAT_URL and NIM_API_KEY are set on the server.`;
          setMessages((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                ...last,
                content: errText,
              };
            }
            return next;
          });
          setIsLoading(false);
          await persistAssistant(cid, errText, "");
        }
      }
    },
    [
      isLoading,
      messages,
      persistAssistant,
      refreshConversations,
      streamViaProxy,
      thinkingMode,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  const headerTitle = useMemo(() => "NVIDIA NIM Chat", []);

  const createConversation = useCallback(async () => {
    if (isLoading) return;
    const { id } = await fetchJson("/api/conversations", { method: "POST" });
    if (!id) return;
    await refreshConversations();
    await loadConversation(id);
  }, [isLoading, loadConversation, refreshConversations]);

  const selectConversation = useCallback(
    async (id) => {
      if (isLoading || id === conversationId) return;
      await loadConversation(id);
    },
    [conversationId, isLoading, loadConversation],
  );

  const deleteConversation = useCallback(
    async (id) => {
      if (isLoading) return;
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      await refreshConversations();
      const list = await fetch("/api/conversations").then((r) => r.json());
      if (!Array.isArray(list)) return;

      if (list.length === 0) {
        await fetch("/api/conversations", { method: "POST" });
        const again = await fetch("/api/conversations").then((r) => r.json());
        if (again[0]?.id) await loadConversation(again[0].id);
        await refreshConversations();
        return;
      }

      if (id === conversationIdRef.current) {
        await loadConversation(list[0].id);
      }
    },
    [isLoading, loadConversation, refreshConversations],
  );

  return {
    ready,
    conversationId,
    conversations,
    messages,
    isLoading,
    showThinking,
    setShowThinking,
    thinkingMode,
    setThinkingMode,
    messagesEndRef,
    sendMessage,
    stopGeneration,
    headerTitle,
    createConversation,
    selectConversation,
    deleteConversation,
  };
}
