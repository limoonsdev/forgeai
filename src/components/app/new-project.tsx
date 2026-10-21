"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { PublicModel } from "@/lib/ai/catalog";
import { PromptComposer } from "@/components/shared/prompt-composer";

const IDEAS = [
  "Landing page for a meeting-notes app, with pricing and FAQ",
  "Personal finance dashboard with charts and a transactions table",
  "Recipe site with search, filters and favourites",
  "Pomodoro timer with daily stats and a dark mode",
  "Portfolio for a product designer with three case studies",
];

export async function createProjectRequest(body: { prompt: string; model: string; tokenSaver: boolean; attachments?: string[] }) {
  const res = await fetch("/api/projects", {
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

  const create = async (prompt: string, tokenSaver = saver, attachments: string[] = []) => {
    if ((!prompt.trim() && !attachments.length) || busy) return false;
    setBusy(true);
    try {
      const { project } = await createProjectRequest({ prompt, model, tokenSaver, attachments });
      try {
        localStorage.removeItem("forged:pending-prompt");
      } catch {}
      router.push(`/project/${project.id}`);
      return true;
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
      return false;
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
        onSubmit={(ids) => create(value, saver, ids)}
        running={busy}
        models={models}
        model={model}
        onModelChange={setModel}
        tokenSaver={saver}
        onTokenSaverChange={setSaver}
        autoFocus
        pickerSide="bottom"
        inputClassName="min-h-[5.5rem]"
        placeholder="Describe the app you want to build. Paste links or screenshots for reference."
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
