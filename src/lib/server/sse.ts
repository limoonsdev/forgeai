import "server-only";
import { subscribe } from "@/lib/ai/run-registry";
import type { RunEvent } from "@/lib/ai/types";

/** Streams the live events of a project's active run as Server-Sent Events. */
export function runEventStream(projectId: string, signal: AbortSignal, opts: { replay?: boolean; initial?: RunEvent[] } = {}) {
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const close = () => {
        if (closed) return;
        closed = true;
        unsubscribe?.();
        try {
          controller.close();
        } catch {}
      };
      const send = (e: RunEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
        } catch {
          close();
        }
        if (e.type === "run_end") setTimeout(close, 10);
      };
      for (const e of opts.initial ?? []) send(e);
      unsubscribe = subscribe(projectId, send, { replay: opts.replay });
      if (!unsubscribe) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "idle" })}\n\n`));
        close();
        return;
      }
      signal.addEventListener("abort", close);
    },
    cancel() {
      unsubscribe?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
