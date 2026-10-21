import { BellIcon, CheckIcon, CircleIcon, DownloadIcon, LeafIcon, PauseIcon, SearchIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { cn } from "@/lib/utils";
import { Reveal, SectionHeading } from "./reveal";

function Card({ title, body, children, className, delay = 0 }: { title: string; body: string; children?: React.ReactNode; className?: string; delay?: number }) {
  return (
    <Reveal delay={delay} className={cn("group relative flex flex-col overflow-hidden rounded-2xl border bg-card/60 p-5 transition-colors hover:border-foreground/15 sm:p-6", className)}>
      {children && <div className="mb-5 flex min-h-[110px] flex-1 items-center [&>*]:w-full">{children}</div>}
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </Reveal>
  );
}

function Terminal() {
  const lines: [string, string?][] = [
    ["$ npm install recharts", "text-foreground"],
    ["added 1 package in 2.1s"],
    ["$ next dev"],
    ["⚠ app/chart.tsx: 'data' is possibly undefined", "text-amber-400"],
    ["✓ fixed: default to an empty array", "text-success"],
    ["✓ compiled / in 412ms", "text-success"],
  ];
  return (
    <div className="h-full rounded-xl border bg-iron p-3.5 font-mono text-[11px] leading-relaxed text-muted-foreground">
      {lines.map(([l, c], i) => (
        <p key={i} className={cn("truncate", c)}>
          {l}
        </p>
      ))}
    </div>
  );
}

function CursorDemo() {
  return (
    <div className="relative h-full min-h-[140px] overflow-hidden rounded-xl border bg-[#f4eee6]">
      <div className="space-y-2 p-3">
        <div className="h-2 w-1/3 rounded bg-[#2b1d14]/70" />
        <div className="h-1.5 w-2/3 rounded bg-[#2b1d14]/20" />
        <div className="mt-3 flex gap-2">
          <div className="h-6 flex-1 rounded border border-[#2b1d14]/15 bg-white" />
          <div className="cursor-target h-6 w-16 rounded bg-[#b4532a]" />
        </div>
      </div>
      <svg viewBox="0 0 24 24" className="cursor-glide absolute size-4 drop-shadow" aria-hidden>
        <path d="M4 2l16 9.5-7 1.6L9.6 20z" fill="white" stroke="black" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

function Lanes() {
  const lanes = [
    ["Coordinator", "Splits the job, reviews the result", 100],
    ["Agent · pages", "app/(shop)/**", 82],
    ["Agent · cart", "components/cart/**", 64],
    ["Agent · admin", "app/admin/**", 47],
  ] as const;
  return (
    <div className="space-y-2.5">
      {lanes.map(([name, scope, pct], i) => (
        <div key={name} className="rounded-lg border bg-background/40 p-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{name}</span>
            <span className="font-mono text-[10px] text-muted-foreground">{scope}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div className={cn("lane-fill h-full rounded-full", i === 0 ? "bg-foreground/60" : "heat-line")} style={{ width: `${pct}%`, animationDelay: `${i * 0.3}s` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Poll() {
  return (
    <div className="rounded-xl border bg-background/40 p-3 text-xs">
      <p className="font-medium">Should orders be paid online?</p>
      <div className="mt-2 grid gap-1.5">
        {["No, pay at the counter", "Yes, with Stripe", "Both"].map((o, i) => (
          <span key={o} className={cn("flex items-center gap-2 rounded-md border px-2 py-1.5", i === 0 && "border-primary/50 bg-primary/10")}>
            {i === 0 ? <CheckIcon className="size-3 text-primary" /> : <CircleIcon className="size-3 opacity-40" />}
            {o}
          </span>
        ))}
      </div>
    </div>
  );
}

function Search() {
  return (
    <div className="space-y-2 rounded-xl border bg-background/40 p-3 text-xs">
      <p className="flex items-center gap-2 text-muted-foreground">
        <SearchIcon className="size-3.5" /> next.js server actions revalidatePath
      </p>
      {["nextjs.org/docs/app/api-reference/functions/revalidatePath", "nextjs.org/docs/app/getting-started/updating-data"].map((u) => (
        <p key={u} className="truncate font-mono text-[10.5px] text-[#4f9dff]">
          {u}
        </p>
      ))}
    </div>
  );
}

function LogoRow({ ids }: { ids: string[] }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ids.map((id) => (
        <span key={id} className="flex size-11 items-center justify-center rounded-xl border bg-background/50">
          <BrandLogo id={id} className="size-5" />
        </span>
      ))}
    </div>
  );
}

export function Capabilities() {
  return (
    <section id="capabilities" className="px-4 py-28 sm:px-6">
      <SectionHeading
        eyebrow="Capabilities"
        title="An agent with real tools, not a code autocomplete."
        description="Everything below is something the agent does on its own during a build. You stay in control: it asks before big decisions, and you can pause it at any step."
      />
      <div className="mx-auto mt-14 grid max-w-6xl gap-4 md:grid-cols-6">
        <Card className="md:col-span-3" title="Its own Linux VM" body="Each project runs in an isolated container under gVisor. The agent installs packages, reads the dev-server log and fixes the errors it finds.">
          <Terminal />
        </Card>
        <Card className="md:col-span-3" delay={0.05} title="A browser it can drive" body="It opens your app inside the VM, clicks, types and scrolls to test it. You see its cursor move in your preview, live.">
          <CursorDemo />
        </Card>
        <Card className="md:col-span-2" title="Sub-agents for big jobs" body="Larger requests are split between up to six helpers working in parallel on separate files. The coordinator reviews what they return.">
          <Lanes />
        </Card>
        <Card className="md:col-span-2" delay={0.05} title="Questions instead of guesses" body="When a choice matters and you didn't specify it, the agent asks one multiple-choice question and waits.">
          <Poll />
        </Card>
        <Card className="md:col-span-2" delay={0.1} title="Web search and docs" body="It looks up current library documentation and reads the pages you link before writing code.">
          <Search />
        </Card>
        <Card className="md:col-span-3" title="Images, video and sound" body="Connect fal, Replicate, Runway, Luma, SeeDance or ElevenLabs with your own keys. The agent generates media and places it in your project.">
          <LogoRow ids={["fal", "replicate", "runway", "luma", "bytedance", "elevenlabs", "stability", "openai"]} />
        </Card>
        <Card className="md:col-span-3" delay={0.05} title="Pings where you already are" body="Get a message on Discord, Slack, Telegram, ntfy or by email when a build finishes or the agent needs an answer.">
          <div className="flex items-center gap-3">
            <LogoRow ids={["discord", "telegram", "ntfy"]} />
            <span className="flex size-11 items-center justify-center rounded-xl border bg-background/50">
              <BellIcon className="size-5" />
            </span>
          </div>
        </Card>
        <Card className="md:col-span-2" title="Pause, resume, compact" body="Pause after any step and continue later. Long conversations are summarised before they reach the model's context limit.">
          <div className="flex h-full items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border bg-background/50">
              <PauseIcon className="size-5" />
            </span>
            <div className="flex-1 space-y-1.5">
              <div className="h-1.5 w-full rounded-full bg-muted" />
              <div className="h-1.5 w-3/4 rounded-full bg-muted" />
              <p className="pt-1 font-mono text-[10px] text-muted-foreground">142 messages → 1 summary</p>
            </div>
          </div>
        </Card>
        <Card className="md:col-span-2" delay={0.05} title="Token saver" body="One switch for lower reasoning effort, trimmed context and shorter replies. Every step shows what it cost.">
          <div className="flex h-full items-center gap-3">
            <span className="flex h-8 items-center gap-1.5 rounded-lg border border-success/40 bg-success/10 px-2.5 text-xs font-medium text-success">
              <LeafIcon className="size-3.5" /> Saver
            </span>
            <span className="font-mono text-xs text-muted-foreground">this run: $0.038</span>
          </div>
        </Card>
        <Card className="md:col-span-2" delay={0.1} title="Your code, your repo" body="Download everything as a ZIP, push to a GitHub repository, or import a repo to keep working on it.">
          <div className="flex h-full items-center gap-3">
            <LogoRow ids={["github"]} />
            <span className="flex size-11 items-center justify-center rounded-xl border bg-background/50">
              <DownloadIcon className="size-5" />
            </span>
          </div>
        </Card>
      </div>
    </section>
  );
}
