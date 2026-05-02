function handleDataPayload(
  payload,
  contentRef,
  thinkingRef,
  toolStepsRef,
  onPartialUpdate,
) {
  if (payload === "[DONE]") {
    return { done: true, streamError: null };
  }
  try {
    const data = JSON.parse(payload);

    if (data.stream_error?.message) {
      return {
        done: true,
        streamError: String(data.stream_error.message),
      };
    }

    if (data.mcp?.event === "start" && toolStepsRef) {
      toolStepsRef.current = [
        ...toolStepsRef.current,
        {
          id: data.mcp.id,
          server: data.mcp.server,
          tool: data.mcp.tool,
          status: "pending",
        },
      ];
      onPartialUpdate();
      return { done: false, streamError: null };
    }

    if (data.mcp?.event === "end" && toolStepsRef) {
      const id = data.mcp.id;
      toolStepsRef.current = toolStepsRef.current.map((s) =>
        s.id === id
          ? {
              ...s,
              status: data.mcp.ok ? "done" : "error",
              error: data.mcp.error ? String(data.mcp.error) : undefined,
            }
          : s,
      );
      onPartialUpdate();
      return { done: false, streamError: null };
    }

    const delta = data.choices?.[0]?.delta;
    if (!delta || typeof delta !== "object")
      return { done: false, streamError: null };

    const text =
      typeof delta.content === "string"
        ? delta.content
        : Array.isArray(delta.content)
          ? delta.content
              .map((p) => (typeof p === "object" && p?.text ? p.text : ""))
              .join("")
          : "";

    const reasoningPiece =
      (typeof delta.reasoning_content === "string"
        ? delta.reasoning_content
        : "") ||
      (typeof delta.reasoning === "string" ? delta.reasoning : "");

    let changed = false;
    if (reasoningPiece) {
      thinkingRef.current += reasoningPiece;
      changed = true;
    }
    if (text) {
      contentRef.current += text;
      changed = true;
    }
    if (changed) onPartialUpdate();
  } catch {
    /* incomplete SSE JSON */
  }
  return { done: false, streamError: null };
}

function drainCompleteLines(
  buffer,
  contentRef,
  thinkingRef,
  toolStepsRef,
  onPartialUpdate,
) {
  const lines = buffer.split("\n");
  const rest = lines.pop() ?? "";
  for (let line of lines) {
    line = line.trim();
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    const { done, streamError } = handleDataPayload(
      payload,
      contentRef,
      thinkingRef,
      toolStepsRef,
      onPartialUpdate,
    );
    if (streamError != null) {
      return { done: true, buffer: "", streamError };
    }
    if (done) {
      return { done: true, buffer: "", streamError: null };
    }
  }
  return { done: false, buffer: rest, streamError: null };
}

/**
 * Reads NVIDIA / OpenAI-style SSE. Does not clear content refs on completion —
 * refs are reset when starting the next assistant message; clearing early races
 * React state updates that read refs asynchronously.
 *
 * Optional `toolStepsRef`: `{ current: Array<{id, server, tool, status}>` updated from MCP SSE lines.
 */
export async function consumeNimStream(response, {
  contentRef,
  thinkingRef,
  toolStepsRef,
  onPartialUpdate,
  setLoadingFalse,
}) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("No response body");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (value) {
        buffer += decoder.decode(value, { stream: true });
      }

      const {
        done: streamDone,
        buffer: nextBuf,
        streamError,
      } = drainCompleteLines(
        buffer,
        contentRef,
        thinkingRef,
        toolStepsRef,
        onPartialUpdate,
      );
      buffer = nextBuf;

      if (streamError != null) {
        contentRef.current = streamError;
        onPartialUpdate();
        setLoadingFalse();
        throw new Error(streamError);
      }

      if (streamDone) {
        onPartialUpdate();
        setLoadingFalse();
        return;
      }

      if (done) {
        if (buffer.trim()) {
          const line = buffer.trim();
          if (line.startsWith("data:")) {
            const payload = line.slice(5).trim();
            const { done: d, streamError: se } = handleDataPayload(
              payload,
              contentRef,
              thinkingRef,
              toolStepsRef,
              onPartialUpdate,
            );
            if (se != null) {
              contentRef.current = se;
              onPartialUpdate();
              setLoadingFalse();
              throw new Error(se);
            }
            if (d) {
              onPartialUpdate();
              setLoadingFalse();
              return;
            }
          }
        }
        onPartialUpdate();
        setLoadingFalse();
        return;
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}
