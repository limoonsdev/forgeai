import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "API reference",
  description: "The Forged.dev REST API: create Next.js projects, prompt the AI agent, stream events, manage files and drive project VMs.",
};

type Endpoint = { method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; path: string; summary: string; body?: string; response?: string; notes?: string };

const SECTIONS: { id: string; title: string; intro?: string; endpoints: Endpoint[] }[] = [
  {
    id: "account",
    title: "Account & models",
    endpoints: [
      { method: "GET", path: "/api/v1/me", summary: "The authenticated user, plan and credit balance.", response: `{ "id": "…", "plan": "pro", "credits": { "balanceMicros": 4820000, "balanceUsd": 4.82 } }` },
      { method: "GET", path: "/api/v1/models", summary: "Models available to you, with live pricing (USD per million tokens), speed and intelligence scores." },
      { method: "GET", path: "/api/v1/credits", summary: "Balance and the last 100 credit transactions (usage, top-ups, referral rewards…)." },
    ],
  },
  {
    id: "projects",
    title: "Projects",
    intro: "A project is a Next.js 16 app (App Router, TypeScript, Tailwind v4). Files live in Forged and are mirrored into the project's VM.",
    endpoints: [
      { method: "GET", path: "/api/v1/projects", summary: "List your projects, most recently updated first." },
      {
        method: "POST",
        path: "/api/v1/projects",
        summary: "Create a project from the Next.js template. Pass a prompt to start the agent immediately.",
        body: `{ "name": "Habit tracker", "prompt": "A habit tracker with streaks", "model": "claude-sonnet-5-5", "tokenSaver": true }`,
        response: `{ "project": { "id": "k3j…", "name": "Habit tracker", … }, "run": { "runId": "run_…", "model": "claude-sonnet-5-5" } }`,
      },
      { method: "GET", path: "/api/v1/projects/:id", summary: "Project details, VM status and the active run (if any)." },
      { method: "PATCH", path: "/api/v1/projects/:id", summary: "Rename, change the default model or the token saver setting.", body: `{ "name": "New name", "model": "claude-opus-5-5", "tokenSaver": false }` },
      { method: "DELETE", path: "/api/v1/projects/:id", summary: "Delete the project, its conversation and its VM." },
      { method: "GET", path: "/api/v1/projects/:id/export", summary: "Download the project as a .zip archive." },
      {
        method: "POST",
        path: "/api/v1/projects/:id/share",
        summary: "Enable or disable the public read-only share link.",
        body: `{ "enabled": true, "allowRemix": true }`,
        response: `{ "enabled": true, "url": "${absoluteUrl("/share/…")}" }`,
      },
    ],
  },
  {
    id: "agent",
    title: "Agent",
    intro:
      "Send a prompt to the agent. It plans, writes files, installs packages, checks the preview and replies. Each step is billed from your credits at the model's token price.",
    endpoints: [
      {
        method: "POST",
        path: "/api/v1/projects/:id/messages",
        summary: "Start an agent run. mode = \"wait\" (default for API keys) blocks until the run ends; \"stream\" returns Server-Sent Events; \"async\" returns 202 immediately.",
        body: `{ "prompt": "Add a pricing section with 3 tiers", "model": "claude-sonnet-5-5", "tokenSaver": true, "mode": "wait" }`,
        response: `{ "run": { "id": "run_…", "status": "completed", "costMicros": 18342 }, "reply": "Done! I added…", "messages": [ … ] }`,
      },
      {
        method: "POST",
        path: "/api/v1/projects/:id/messages",
        summary: "Answer a poll. When a run ends with status awaiting_input, the agent asked a question via ask_user.",
        body: `{ "pollAnswer": { "toolCallId": "toolu_…", "answer": "Ocean blue" } }`,
      },
      { method: "GET", path: "/api/v1/projects/:id/messages", summary: "Full conversation (user, assistant and tool messages) and the latest run." },
      { method: "GET", path: "/api/v1/projects/:id/events", summary: "Subscribe (SSE) to the live events of the run in progress. Sends {\"type\":\"idle\"} when nothing is running." },
      { method: "POST", path: "/api/v1/projects/:id/stop", summary: "Stop the run in progress after the current step." },
    ],
  },
  {
    id: "files",
    title: "Files",
    endpoints: [
      { method: "GET", path: "/api/v1/projects/:id/files", summary: "List files with sizes. Add ?content=1 to include every file's content." },
      { method: "GET", path: "/api/v1/projects/:id/files/:path", summary: "Read one file, e.g. /files/app/page.tsx." },
      { method: "PUT", path: "/api/v1/projects/:id/files/:path", summary: "Create or overwrite a file (synced to the VM instantly).", body: `{ "content": "export default function Page() { … }" }` },
      { method: "DELETE", path: "/api/v1/projects/:id/files/:path", summary: "Delete a file." },
    ],
  },
  {
    id: "vm",
    title: "VM (sandbox)",
    intro: "Every project runs in its own isolated VM with `next dev`. VMs sleep after 30 minutes of inactivity and boot again on demand.",
    endpoints: [
      { method: "GET", path: "/api/v1/projects/:id/sandbox", summary: "VM status and preview URL." },
      { method: "POST", path: "/api/v1/projects/:id/sandbox", summary: "Boot (or wake) the VM, sync the files and start the dev server.", response: `{ "status": "running", "previewUrl": "https://…" }` },
      { method: "DELETE", path: "/api/v1/projects/:id/sandbox", summary: "Stop the VM." },
      {
        method: "POST",
        path: "/api/v1/projects/:id/sandbox/exec",
        summary: "Run a shell command inside the VM (working directory = project root).",
        body: `{ "command": "npx tsc --noEmit", "timeoutMs": 120000 }`,
        response: `{ "exitCode": 0, "stdout": "…", "stderr": "" }`,
      },
    ],
  },
];

const EVENTS: [string, string][] = [
  ["run_start", "A run started: { runId, model }"],
  ["message", "A message was persisted (user, assistant or tool): { message }"],
  ["assistant_start", "The model started a new step: { messageId, model }"],
  ["text_delta / thinking_delta", "Streaming reply text / reasoning summary"],
  ["tool_call_start / tool_call_delta", "The model is calling a tool; input JSON streams in chunks"],
  ["tool_result", "A tool finished: { toolCallId, result }"],
  ["files_changed", "Files were written or deleted: { paths, deleted }"],
  ["plan", "The agent updated its checklist: { items }"],
  ["poll", "The agent asked you a question (ask_user): { toolCallId, poll }"],
  ["sandbox", "VM status changed: { status, previewUrl }"],
  ["usage", "A step was billed: { costMicros, runCostMicros, balanceMicros }"],
  ["run_end", "The run finished: { status: completed | awaiting_input | stopped | error | insufficient_credits, error? }"],
];

const METHOD_COLORS: Record<Endpoint["method"], string> = {
  GET: "bg-sky-500/15 text-sky-400",
  POST: "bg-emerald-500/15 text-emerald-400",
  PUT: "bg-amber-500/15 text-amber-400",
  PATCH: "bg-violet-500/15 text-violet-400",
  DELETE: "bg-rose-500/15 text-rose-400",
};

function Code({ children }: { children: string }) {
  return <pre className="overflow-x-auto rounded-xl border bg-surface p-4 font-mono text-xs leading-relaxed text-muted-foreground">{children}</pre>;
}

export default function DocsPage() {
  const base = absoluteUrl();
  return (
    <div className="mx-auto max-w-6xl px-5 pt-32 pb-24">
      <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="hidden lg:block">
          <nav className="sticky top-28 space-y-1 text-sm">
            {[["intro", "Introduction"], ["auth", "Authentication"], ...SECTIONS.map((s) => [s.id, s.title]), ["events", "Streaming events"], ["errors", "Errors & limits"], ["status", "Status"]].map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-lg px-3 py-1.5 text-muted-foreground transition hover:bg-accent hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
        </aside>
        <article className="min-w-0 space-y-16">
          <section id="intro">
            <p className="text-sm font-medium text-primary">API reference</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight sm:text-5xl">
              Forge apps <span className="font-serif font-normal italic text-gradient-ember">programmatically.</span>
            </h1>
            <p className="mt-4 max-w-2xl text-muted-foreground">
              Everything you can do in the Forged app is available over a simple JSON REST API: create Next.js projects, prompt the agent, stream its work in
              real time, read and write files, and run commands in each project&apos;s VM.
            </p>
            <div className="mt-6">
              <Code>{`Base URL: ${base}/api/v1`}</Code>
            </div>
          </section>

          <section id="auth" className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Authentication</h2>
            <p className="text-muted-foreground">
              Create a key in{" "}
              <Link href="/settings/api-keys" className="text-primary hover:underline">
                Settings → API keys
              </Link>{" "}
              and send it as a bearer token. Keys spend your credits — keep them secret and rotate them if they leak.
            </p>
            <Code>{`curl ${base}/api/v1/me \\
  -H "Authorization: Bearer fg_live_xxxxxxxxxxxxxxxx"`}</Code>
            <p className="text-sm text-muted-foreground">Quick start — create a project and let the agent build it, waiting for the result:</p>
            <Code>{`const res = await fetch("${base}/api/v1/projects", {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.FORGED_API_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Recipe app" }),
});
const { project } = await res.json();

const run = await fetch(\`${base}/api/v1/projects/\${project.id}/messages\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${process.env.FORGED_API_KEY}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ prompt: "A recipe sharing app with search and favorites", mode: "wait" }),
}).then((r) => r.json());

console.log(run.reply, run.run.costMicros / 1e6, "USD");`}</Code>
          </section>

          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="space-y-5">
              <h2 className="text-2xl font-semibold tracking-tight">{s.title}</h2>
              {s.intro && <p className="text-muted-foreground">{s.intro}</p>}
              <div className="space-y-4">
                {s.endpoints.map((e, i) => (
                  <div key={i} className="rounded-2xl border bg-card/50 p-5">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`rounded-md px-2 py-0.5 font-mono text-xs font-semibold ${METHOD_COLORS[e.method]}`}>{e.method}</span>
                      <code className="font-mono text-sm">{e.path}</code>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">{e.summary}</p>
                    {e.body && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Body</p>
                        <Code>{e.body}</Code>
                      </div>
                    )}
                    {e.response && (
                      <div className="mt-3">
                        <p className="mb-1.5 text-xs font-medium text-muted-foreground">Response</p>
                        <Code>{e.response}</Code>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section id="events" className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Streaming events</h2>
            <p className="text-muted-foreground">
              With <code className="font-mono text-foreground">mode: &quot;stream&quot;</code> (or <code className="font-mono text-foreground">Accept: text/event-stream</code>) the response is a
              Server-Sent Events stream. Each event is a JSON object on a <code className="font-mono">data:</code> line.
            </p>
            <div className="overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <tbody>
                  {EVENTS.map(([name, desc]) => (
                    <tr key={name} className="border-b last:border-0">
                      <td className="w-64 bg-card/60 px-4 py-2.5 font-mono text-xs text-primary">{name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Code>{`curl -N ${base}/api/v1/projects/$PROJECT/messages \\
  -H "Authorization: Bearer $FORGED_API_KEY" -H "Content-Type: application/json" \\
  -d '{"prompt":"Make the hero darker","mode":"stream"}'

data: {"type":"run_start","runId":"run_…","model":"claude-sonnet-5-5"}
data: {"type":"text_delta","messageId":"msg_…","text":"Sure — "}
data: {"type":"tool_call_start","toolCallId":"toolu_…","name":"edit_file"}
data: {"type":"run_end","status":"completed","runCostMicros":9120}`}</Code>
          </section>

          <section id="errors" className="space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight">Errors &amp; limits</h2>
            <p className="text-muted-foreground">Errors use standard HTTP codes and a JSON body:</p>
            <Code>{`{ "error": { "code": "insufficient_credits", "message": "You're out of credits…" } }`}</Code>
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
              <li>
                <code className="font-mono text-foreground">401 unauthorized</code> — missing or invalid key
              </li>
              <li>
                <code className="font-mono text-foreground">402 insufficient_credits</code> — top up or invite a friend
              </li>
              <li>
                <code className="font-mono text-foreground">403 model_unavailable</code> — model not configured or not on your plan
              </li>
              <li>
                <code className="font-mono text-foreground">409 run_in_progress</code> — one run per project at a time
              </li>
              <li>
                <code className="font-mono text-foreground">429 rate_limited</code> — 120 requests/minute per key (30/min for sandbox exec)
              </li>
            </ul>
          </section>

          <section id="status" className="space-y-3">
            <h2 className="text-2xl font-semibold tracking-tight">Status</h2>
            <p className="text-muted-foreground">
              Health check: <code className="font-mono text-foreground">GET /api/health</code> returns database, AI provider and sandbox availability.
            </p>
          </section>
        </article>
      </div>
    </div>
  );
}
