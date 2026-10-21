"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PublicModel } from "@/lib/ai/catalog";
import { PromptComposer } from "@/components/shared/prompt-composer";

const IDEAS = [
  "A SaaS landing page for an AI meeting assistant with pricing and FAQ",
  "A personal finance dashboard with charts and a transactions table",
  "A recipe sharing app with search, filters and favorites",
  "A Pomodoro timer with stats and a beautiful dark mode",
  "A portfolio for a product designer with case studies",
];

export async function createProjectRequest(body: { prompt: string; model: string; tokenSaver: boolean }) {
  const res = await fetch("/api/v1/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message ?? "Could not create the project");
  return data as { project: { id: string } };
}

export function NewProject({ models, defaultModel, defaultTokenSaver }: { models: PublicModel[]; defaultModel: string; defaultTokenSaver: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState("");
  const [model, setModel] = useState(defaultModel);
  const [saver, setSaver] = useState(defaultTokenSaver);
  const [busy, setBusy] = useState(false);
  const autoStarted = useRef(false);

  const create = async (prompt: string, tokenSaver = saver) => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    try {
      const { project } = await createProjectRequest({ prompt, model, tokenSaver });
      try {
        localStorage.removeItem("forged:pending-prompt");
      } catch {}
      router.push(`/project/${project.id}`);
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  };

  // Prompt typed on the landing page before signing up → start forging immediately.
  useEffect(() => {
    if (autoStarted.current) return;
    const fromUrl = params.get("prompt");
    let pending: { prompt: string; tokenSaver?: boolean } | null = null;
    try {
      const raw = localStorage.getItem("forged:pending-prompt");
      if (raw) pending = JSON.parse(raw);
    } catch {}
    const prompt = fromUrl ?? pending?.prompt;
    if (!prompt) return;
    autoStarted.current = true;
    const saverFlag = params.get("saver") === "1" || Boolean(pending?.tokenSaver);
    window.history.replaceState(null, "", "/dashboard");
    setValue(prompt);
    void create(prompt, saverFlag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PromptComposer
        value={value}
        onChange={setValue}
        onSubmit={() => create(value)}
        running={busy}
        models={models}
        model={model}
        onModelChange={setModel}
        tokenSaver={saver}
        onTokenSaverChange={setSaver}
        minRows={3}
        autoFocus
        pickerSide="bottom"
        placeholder="Describe the app you want to forge… (Enter to start)"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button
            key={idea}
            onClick={() => setValue(idea)}
            className="rounded-full border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-foreground"
          >
            {idea}
          </button>
        ))}
      </div>
    </div>
  );
}
