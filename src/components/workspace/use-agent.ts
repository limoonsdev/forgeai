"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { ChatMessageDTO, PlanItem, PollInput, RunEvent, ToolResultPart } from "@/lib/ai/types";

export type StreamingTool = { id: string; name: string; json: string };
export type StreamingMessage = { messageId: string; model: string; text: string; thinking: string; tools: StreamingTool[] };
export type SandboxState = { status: string; previewUrl: string | null; message?: string };
export type PendingPoll = { toolCallId: string; poll: PollInput };

export type AgentCallbacks = {
  onFilesChanged?: (paths: string[], deleted: string[]) => void;
  onProject?: (p: { name?: string; description?: string }) => void;
  onSandbox?: (s: SandboxState & { refresh?: boolean }) => void;
  onBalance?: (micros: number) => void;
  onOutOfCredits?: () => void;
};

async function readSSE(res: Response, onEvent: (e: RunEvent | { type: "idle" }) => void) {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        try {
          onEvent(JSON.parse(line.slice(6)));
        } catch {
          // ignore malformed lines
        }
      }
    }
  }
}

export function useAgent(projectId: string, initial: { messages: ChatMessageDTO[]; running: boolean }, cb: AgentCallbacks) {
  const [messages, setMessages] = useState<ChatMessageDTO[]>(initial.messages);
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null);
  const [running, setRunning] = useState(initial.running);
  const [liveResults, setLiveResults] = useState<Record<string, ToolResultPart>>({});
  const [plan, setPlan] = useState<PlanItem[] | null>(null);
  const [runCost, setRunCost] = useState(0);
  const [lastError, setLastError] = useState<string | null>(null);
  const cbRef = useRef(cb);
  useEffect(() => {
    cbRef.current = cb;
  });
  const abortRef = useRef<AbortController | null>(null);

  const upsert = useCallback((m: ChatMessageDTO) => {
    setMessages((prev) => {
      const i = prev.findIndex((x) => x.id === m.id);
      if (i === -1) return [...prev, m].sort((a, b) => a.seq - b.seq);
      const next = prev.slice();
      next[i] = m;
      return next;
    });
  }, []);

  const handle = useCallback(
    (e: RunEvent | { type: "idle" }) => {
      switch (e.type) {
        case "idle":
          setRunning(false);
          break;
        case "run_start":
          setRunning(true);
          setRunCost(0);
          setLastError(null);
          break;
        case "message":
          if (e.message.role === "user") setMessages((prev) => prev.filter((m) => !m.id.startsWith("tmp_")));
          upsert(e.message);
          setStreaming((s) => (s && s.messageId === e.message.id ? null : s));
          break;
        case "assistant_start":
          setStreaming({ messageId: e.messageId, model: e.model, text: "", thinking: "", tools: [] });
          break;
        case "text_delta":
          setStreaming((s) => (s && s.messageId === e.messageId ? { ...s, text: s.text + e.text } : s));
          break;
        case "thinking_delta":
          setStreaming((s) => (s && s.messageId === e.messageId ? { ...s, thinking: s.thinking + e.text } : s));
          break;
        case "tool_call_start":
          setStreaming((s) =>
            s && s.messageId === e.messageId ? { ...s, tools: [...s.tools, { id: e.toolCallId, name: e.name, json: "" }] } : s,
          );
          break;
        case "tool_call_delta":
          setStreaming((s) =>
            s && s.messageId === e.messageId
              ? { ...s, tools: s.tools.map((t) => (t.id === e.toolCallId ? { ...t, json: t.json + e.partialJson } : t)) }
              : s,
          );
          break;
        case "tool_result":
          setLiveResults((r) => ({ ...r, [e.toolCallId]: e.result }));
          break;
        case "plan":
          setPlan(e.items);
          break;
        case "files_changed":
          cbRef.current.onFilesChanged?.(e.paths, e.deleted ?? []);
          break;
        case "project":
          cbRef.current.onProject?.(e);
          break;
        case "sandbox":
          cbRef.current.onSandbox?.({ status: e.status, previewUrl: e.previewUrl ?? null, message: e.message, refresh: e.message === "refresh" });
          break;
        case "usage":
          setRunCost(e.runCostMicros);
          cbRef.current.onBalance?.(e.balanceMicros);
          break;
        case "run_end":
          setRunning(false);
          setStreaming(null);
          if (e.error) {
            setLastError(e.error);
            toast.error(e.error);
          }
          if (e.status === "insufficient_credits") cbRef.current.onOutOfCredits?.();
          break;
      }
    },
    [upsert],
  );

  const connect = useCallback(
    async (res: Response) => {
      try {
        await readSSE(res, handle);
      } catch (err) {
        if ((err as Error).name !== "AbortError") console.warn("stream interrupted", err);
      } finally {
        // Re-sync with the database (covers dropped connections).
        const r = await fetch(`/api/projects/${projectId}/messages`).catch(() => null);
        if (r?.ok) {
          const data = (await r.json()) as { messages: ChatMessageDTO[]; latestRun: { status: string } | null };
          setMessages(data.messages);
          if (data.latestRun?.status !== "running") {
            setRunning(false);
            setStreaming(null);
          }
        }
      }
    },
    [handle, projectId],
  );

  // Resume a run that is already in progress (page reload, second tab…).
  useEffect(() => {
    if (!initial.running) return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    fetch(`/api/projects/${projectId}/events`, { signal: ctrl.signal })
      .then((res) => (res.ok ? connect(res) : setRunning(false)))
      .catch(() => {});
    return () => ctrl.abort();
  }, [initial.running, projectId, connect]);

  const send = useCallback(
    async (body: { prompt?: string; pollAnswer?: { toolCallId: string; answer: string }; model: string; tokenSaver: boolean }) => {
      setRunning(true);
      setLastError(null);
      setPlan(null);
      if (body.prompt) {
        // Optimistic user bubble, replaced by the persisted message as soon as the stream starts.
        setMessages((prev) => [
          ...prev,
          {
            id: `tmp_${Date.now()}`,
            seq: Number.MAX_SAFE_INTEGER,
            role: "user",
            content: { kind: "user", text: body.prompt! },
            costMicros: 0,
            inputTokens: 0,
            outputTokens: 0,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      let res: Response;
      try {
        res = await fetch(`/api/projects/${projectId}/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
          body: JSON.stringify({ ...body, mode: "stream" }),
          signal: ctrl.signal,
        });
      } catch {
        setRunning(false);
        toast.error("Network error — please retry.");
        return false;
      }
      if (!res.ok) {
        setRunning(false);
        setMessages((prev) => prev.filter((m) => !m.id.startsWith("tmp_")));
        const data = await res.json().catch(() => null);
        const code = data?.error?.code;
        if (code === "insufficient_credits") cbRef.current.onOutOfCredits?.();
        else toast.error(data?.error?.message ?? "Could not start the agent");
        return false;
      }
      void connect(res);
      return true;
    },
    [projectId, connect],
  );

  const stop = useCallback(async () => {
    await fetch(`/api/projects/${projectId}/stop`, { method: "POST" }).catch(() => {});
  }, [projectId]);

  // Results by tool call id (persisted tool messages + live results).
  const results = useMemo(() => {
    const map: Record<string, ToolResultPart> = { ...liveResults };
    for (const m of messages) if (m.content.kind === "tool") for (const r of m.content.results) map[r.toolCallId] = r;
    return map;
  }, [messages, liveResults]);

  const pendingPoll = useMemo<PendingPoll | null>(() => {
    const last = messages[messages.length - 1];
    if (!last || last.content.kind !== "tool") return null;
    const pending = last.content.results.find((r) => r.pending && r.name === "ask_user");
    if (!pending) return null;
    const poll = pending.meta?.poll as PollInput | undefined;
    return poll ? { toolCallId: pending.toolCallId, poll } : null;
  }, [messages]);

  const latestPlan = useMemo<PlanItem[] | null>(() => {
    if (plan) return plan;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") return null;
      if (m.content.kind === "tool") {
        const r = [...m.content.results].reverse().find((x) => x.name === "update_plan");
        if (r?.meta?.items) return r.meta.items as PlanItem[];
      }
    }
    return null;
  }, [messages, plan]);

  return { messages, streaming, running, results, pendingPoll, plan: latestPlan, runCost, lastError, send, stop };
}
