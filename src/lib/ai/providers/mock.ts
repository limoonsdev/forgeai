import "server-only";
import type { AssistantContent, NeutralMessage, ProviderEvent } from "../types";
import type { ProviderRequest, ProviderStream } from "./shared";

/**
 * Offline, scripted agent used for local development, demos and end-to-end tests.
 * It exercises the full pipeline (plan, polls, file writes, preview checks) without any API key.
 */

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let counter = 0;
const callId = () => `mock_${Date.now().toString(36)}_${(counter++).toString(36)}`;

function lastUserIndex(messages: NeutralMessage[]) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return i;
  return -1;
}

const STOP = new Set(["build", "create", "make", "landing", "page", "website", "site", "with", "that", "this", "from", "your", "for", "and", "the", "app", "application", "please", "fais", "crée", "créer", "une", "pour", "avec"]);

function titleFrom(prompt: string) {
  const named = prompt.match(/(?:called|named|appel[ée]e?|nomm[ée]e?)\s+["“]?([\p{L}\p{N}][\p{L}\p{N}\s'-]{1,40}?)["”]?(?:[.,!?]|$)/iu);
  if (named) return named[1].trim().split(/\s+/).slice(0, 4).join(" ");
  const words = prompt
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w.toLowerCase()))
    .slice(0, 3);
  const name = words.map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" ");
  return name || "My Forged App";
}

function esc(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${").replace(/"/g, '\\"');
}

function pageSource(title: string, prompt: string, accent: string) {
  return `import { ArrowRight, Sparkles, Zap, Shield, Rocket } from "lucide-react";
import { FeatureCard } from "@/components/feature-card";

const features = [
  { icon: Zap, title: "Instant", body: "Blazing fast pages rendered on the server with Next.js." },
  { icon: Shield, title: "Reliable", body: "Typed end to end with TypeScript and tested patterns." },
  { icon: Rocket, title: "Ready to ship", body: "Responsive, accessible and SEO friendly out of the box." },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-neutral-950 text-white">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[${accent}]/30 blur-3xl" />
      <section className="relative mx-auto flex max-w-5xl flex-col items-center px-6 pt-32 pb-20 text-center">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <Sparkles className="size-3.5" /> Forged with AI
        </span>
        <h1 className="mt-6 text-5xl font-semibold tracking-tight sm:text-7xl">${esc(title)}</h1>
        <p className="mt-6 max-w-2xl text-lg text-white/60">${esc(prompt.slice(0, 220))}</p>
        <div className="mt-10 flex gap-3">
          <a href="#features" className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90">
            Get started <ArrowRight className="size-4" />
          </a>
          <a href="#features" className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/5">
            Learn more
          </a>
        </div>
      </section>
      <section id="features" className="relative mx-auto grid max-w-5xl gap-4 px-6 pb-32 sm:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} icon={f.icon} title={f.title} body={f.body} />
        ))}
      </section>
    </main>
  );
}
`;
}

const featureCardSource = `import type { LucideIcon } from "lucide-react";

export function FeatureCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="flex size-10 items-center justify-center rounded-xl bg-white/10">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-medium">{title}</h3>
      <p className="mt-2 text-sm text-white/60">{body}</p>
    </div>
  );
}
`;

type Step = { text?: string; calls?: { name: string; input: Record<string, unknown> }[] };

function planFor(messages: NeutralMessage[]): Step {
  const ui = lastUserIndex(messages);
  const user = messages[ui];
  const prompt = user?.role === "user" && user.content.kind !== "compaction" ? user.content.text : "";
  const after = messages.slice(ui + 1);
  const assistantSteps = after.filter((m) => m.role === "assistant").length;
  const isFirstTurn = messages.filter((m) => m.role === "user" && m.content.kind !== "compaction").length === 1;
  const wantsPoll = /\?|poll|sondage|ask me/i.test(prompt) && isFirstTurn;

  // Find a poll answer if the previous step asked the user something.
  let accent = "#ff7a1a";
  for (const m of after) {
    if (m.role === "tool") {
      for (const r of m.content.results) {
        if (r.name === "ask_user" && !r.pending) {
          if (/blue|bleu|ocean/i.test(r.output)) accent = "#3b82f6";
          else if (/green|vert|nature/i.test(r.output)) accent = "#10b981";
          else if (/violet|purple/i.test(r.output)) accent = "#8b5cf6";
        }
      }
    }
  }

  const title = titleFrom(prompt);
  const script: Step[] = [];
  if (wantsPoll) {
    script.push({
      text: "Great idea! One quick question before I start forging:",
      calls: [
        {
          name: "ask_user",
          input: {
            question: "Which visual direction do you prefer?",
            options: [
              { label: "Ember orange", description: "Warm, bold and energetic" },
              { label: "Ocean blue", description: "Calm, trustworthy and clean" },
              { label: "Nature green", description: "Fresh, organic and friendly" },
            ],
            allow_custom: true,
          },
        },
      ],
    });
  }
  if (isFirstTurn) {
    script.push({
      text: "Let's forge it. Here's the plan:",
      calls: [
        { name: "set_project_info", input: { name: title, description: prompt.slice(0, 140) } },
        {
          name: "update_plan",
          input: {
            items: [
              { title: "Design the landing page", status: "in_progress" },
              { title: "Build reusable components", status: "pending" },
              { title: "Verify the preview", status: "pending" },
            ],
          },
        },
      ],
    });
  }
  script.push({
    text: isFirstTurn ? "Writing the page and components…" : "Applying your changes…",
    calls: [
      { name: "write_file", input: { path: "components/feature-card.tsx", content: featureCardSource } },
      { name: "write_file", input: { path: "app/page.tsx", content: pageSource(isFirstTurn ? title : titleFrom(prompt), prompt, accent) } },
    ],
  });
  script.push({
    calls: [
      {
        name: "update_plan",
        input: {
          items: [
            { title: "Design the landing page", status: "done" },
            { title: "Build reusable components", status: "done" },
            { title: "Verify the preview", status: "in_progress" },
          ],
        },
      },
      { name: "check_preview", input: { path: "/" } },
    ],
  });
  script.push({
    text: `Done! 🔥 I forged **${title}**:\n\n- A responsive hero with a glowing accent and clear call-to-action\n- A reusable \`FeatureCard\` component with three highlights\n- Verified that the preview compiles\n\n**Next ideas:** add a pricing section, or wire up a waitlist form with a Server Action.\n\n_This answer comes from the offline **Forged Demo** model. Add an \`ANTHROPIC_API_KEY\` or \`OPENROUTER_API_KEY\` to use real AI models._`,
  });
  return script[Math.min(assistantSteps, script.length - 1)];
}

export async function* streamMock(req: ProviderRequest): ProviderStream {
  const step = planFor(req.messages);
  const parts: AssistantContent["parts"] = [];
  let outChars = 0;
  if (step.text) {
    for (const chunk of step.text.match(/.{1,6}/gs) ?? []) {
      if (req.signal?.aborted) throw new Error("aborted");
      await sleep(12);
      yield { type: "text_delta", text: chunk };
    }
    parts.push({ type: "text", text: step.text });
    outChars += step.text.length;
  }
  for (const call of step.calls ?? []) {
    const id = callId();
    yield { type: "tool_call_start", id, name: call.name };
    const json = JSON.stringify(call.input);
    for (const chunk of json.match(/.{1,400}/gs) ?? []) {
      await sleep(8);
      yield { type: "tool_call_delta", id, partialJson: chunk };
    }
    parts.push({ type: "tool_call", id, name: call.name, input: call.input });
    outChars += json.length;
  }
  const inChars = JSON.stringify(req.messages).length + req.system.length;
  const done: ProviderEvent = {
    type: "done",
    parts,
    usage: { inputTokens: Math.round(inChars / 4), outputTokens: Math.round(outChars / 4), cacheReadTokens: 0, cacheWriteTokens: 0 },
    stopReason: step.calls?.length ? "tool_use" : "end_turn",
    servedModel: "forged-demo",
  };
  yield done;
}
