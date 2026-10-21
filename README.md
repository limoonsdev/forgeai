<p align="center">
  <img src="public/logo.png" width="96" alt="Forged.dev logo" />
</p>

<h1 align="center">Forged.dev</h1>

<p align="center"><strong>The AI agent that forges production-ready Next.js apps from a single prompt.</strong><br/>
Describe it → the agent plans, codes, installs and verifies a real Next.js app in its own VM → you ship it.</p>

---

## What's inside

| Area | What you get |
| --- | --- |
| **Landing** | Animated hero (rising embers, typewriter prompt box, 3D product preview on scroll), stack marquee, how-it-works, bento features, models, "Next.js only" section, pricing, referral banner, FAQ, final CTA. `/pricing`, `/docs` (API reference). |
| **Auth** | Email + password, GitHub & Google OAuth (when configured), password reset by email, account linking — [Better Auth](https://better-auth.com) on Postgres. |
| **Workspace** | Lovable-style split view: streaming chat (text, reasoning summaries, live tool activity, plans), live preview iframe with device sizes & routes, file tree + Monaco editor (self-hosted), share dialog, zip export. |
| **Model choice** | Claude Fable 5.1 / Opus 5.5 / Sonnet 5.5 / Haiku 5.5 (Anthropic SDK), GPT-5.6, Gemini, Grok, DeepSeek, Qwen, Kimi (OpenRouter), plus an offline **Forged Demo** model. Per-project and per-message switching, plan gating, live pricing sync. |
| **Complete agent** | 15 tools: list/read/write/edit/delete/rename/search files, install packages, run commands, check preview, read logs, **ask_user polls**, update plan, load skills, set project info. Validated inputs, append-only history, auto-fix loop. |
| **Next.js only** | The system prompt forbids plain HTML / other frameworks / non-web languages (C++, Python scripts, native apps…) and offers a web alternative instead. Every project starts from `runtime/template` (Next 16, React 19, TS, Tailwind v4). |
| **Polls** | The agent can ask a multiple-choice question; the run pauses, the user answers in an interactive card, the run resumes. |
| **Token saver** | One toggle: lower reasoning effort, smaller output budget, server-side context editing (Claude) or client-side trimming (others), terse replies. Prompt caching is always on. |
| **Skills** | 8 built-in skills + import your own `SKILL.md` (paste, upload, or GitHub/GitLab/Gist URL). The agent sees names + descriptions and loads full skills on demand. |
| **Credits** | Micro-dollar ledger, per-step billing from real token usage × markup, live balance, history, Stripe top-ups and subscriptions (idempotent webhooks). |
| **Referral** | `forged.dev/r/CODE` → the friend gets **$5** on sign-up, the referrer gets **$5** once the friend's first agent run completes (anti-abuse). |
| **Preferences** | Default model, token saver, reply language, design style, clarifying questions, auto-fix, custom instructions, theme. |
| **Sharing** | Public read-only session links (conversation + code + live preview), one-click **remix**, regenerate/disable links. |
| **REST API** | API keys (hashed) + `/api/v1/*` used by both the web app (cookie) and your code (Bearer): projects, agent runs (wait / SSE stream / async), files, VM boot/stop/exec, export, credits. |
| **VMs** | One isolated VM per project running `next dev`: **Docker** (self-hosted, default) or **E2B** (cloud microVMs). Files live in Postgres and are synced into the VM. Idle VMs are reaped. |

## Architecture

```
Browser ──► Next.js 16 app (this repo)
             ├─ app/(marketing)   landing, pricing, docs
             ├─ app/(auth)        login, signup, reset
             ├─ app/(app)         dashboard, settings
             ├─ app/project/[id]  workspace (chat + preview + code)
             ├─ app/share/[token] public session
             └─ app/api
                 ├─ auth/[...all]          Better Auth
                 ├─ v1/**                  REST API (session cookie or API key)
                 ├─ settings/**, billing/** web-app only
                 └─ stripe/webhook
src/lib
 ├─ ai/          models, providers (anthropic, openrouter, mock), agent loop,
 │               tools, prompts, per-turn context, run registry (SSE fan-out)
 ├─ sandbox/     provider interface + docker + e2b, file sync, idle reaper
 ├─ server/      credits ledger, referrals, projects, files, api keys, stripe…
 ├─ skills/      built-in skills, SKILL.md parser/importer
 └─ db/          Drizzle schema (Postgres)
runtime/
 ├─ template/    the Next.js starter every project is forged from
 ├─ Dockerfile   project VM image (template deps pre-installed)
 └─ e2b/         E2B template Dockerfile
```

**Agent loop** (`src/lib/ai/agent.ts`): the user turn is stored with a frozen context block (file tree, skills, preferences) → the model streams → the step is billed and persisted → tools run → results are persisted → repeat until the model stops, asks a poll, runs out of credits or is stopped. The system prompt and tool list never change, so the conversation prefix stays byte-identical (prompt caching + Claude preserved thinking).

## Quick start (local)

Requirements: Node 22+, Docker (for Postgres and project VMs).

```bash
npm install                        # also self-hosts Monaco into public/monaco
cp .env.example .env               # then set BETTER_AUTH_SECRET (openssl rand -base64 32)
docker compose up -d postgres
npm run db:migrate                 # apply drizzle/ migrations
npm run runtime:build              # build the project VM image (forged-runtime:latest)
npm run dev                        # http://localhost:3000
```

No AI key yet? In development the offline **Forged Demo** model is enabled automatically, so you can try the full flow (agent steps, polls, VM preview, credits, referrals). Add `ANTHROPIC_API_KEY` and/or `OPENROUTER_API_KEY` for real models.

## Configuration

All variables are documented in [`.env.example`](.env.example). The important ones:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Auth secret and public URL |
| `ANTHROPIC_API_KEY` | Claude models |
| `OPENROUTER_API_KEY` | GPT, Gemini, Grok, DeepSeek, Qwen, Kimi |
| `FORGED_MOCK_AI` | `1` forces the demo model on, `0` off |
| `FORGED_SANDBOX_PROVIDER` | `docker` (default), `e2b` or `none` |
| `FORGED_PREVIEW_URL_TEMPLATE` | How browsers reach a container: `http://localhost:{port}` locally, e.g. `https://{port}.preview.example.com` behind a reverse proxy |
| `E2B_API_KEY`, `E2B_TEMPLATE` | E2B sandboxes |
| `SIGNUP_BONUS_USD`, `REFERRAL_REWARD_USD`, `REFEREE_REWARD_USD`, `CREDIT_MARKUP` | Credit rules |
| `GITHUB_CLIENT_ID/SECRET`, `GOOGLE_CLIENT_ID/SECRET` | OAuth buttons appear when set |
| `RESEND_API_KEY`, `EMAIL_FROM` | Password reset emails (logged to the console otherwise) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_STUDIO` | Billing |

### Models

The catalog lives in [`src/lib/ai/models.ts`](src/lib/ai/models.ts). Add an entry with `provider: "anthropic"` (model id sent to the Anthropic API) or `provider: "openrouter"` (any OpenRouter model id). OpenRouter prices and availability are refreshed hourly from the OpenRouter catalog; unknown ids are hidden automatically. `minPlan` gates a model to Pro/Studio.

Claude requests use adaptive thinking with summarized reasoning, per-model effort (`low` in token-saver mode), automatic prompt caching, eager tool-input streaming (inputs are validated with zod before running), and server-side refusal fallbacks where supported.

### Project VMs

- **Docker (self-hosted)** — build the image with `npm run runtime:build`. Each project gets a container (`node` user, all capabilities dropped, `no-new-privileges`, memory/CPU/PID limits, tini as PID 1). The container's port 3000 is published on `127.0.0.1`; set `FORGED_PREVIEW_URL_TEMPLATE` for your domain and put a reverse proxy in front.
  > ⚠️ Containers on the default bridge network can reach services on the host. In production run them on a dedicated network (`FORGED_DOCKER_NETWORK`) with egress rules that block your database/metadata endpoints, or use E2B.
- **E2B (cloud)** — `cd runtime && e2b template build -n forged-nextjs -d e2b/e2b.Dockerfile`, then set `FORGED_SANDBOX_PROVIDER=e2b`, `E2B_API_KEY`, `E2B_TEMPLATE=forged-nextjs`. Preview URLs are public HTTPS hosts provided by E2B.

Files are stored in Postgres (source of truth) and pushed into the VM on boot and on every change; commands the agent runs in the VM (e.g. `npx shadcn add`) are pulled back. VMs idle for `FORGED_SANDBOX_IDLE_MIN` minutes are stopped and rebooted on demand.

### Stripe

1. Create two recurring prices (Pro $20/mo, Studio $60/mo) and set `STRIPE_PRICE_PRO` / `STRIPE_PRICE_STUDIO`.
2. Add a webhook to `https://YOUR_DOMAIN/api/stripe/webhook` with events `checkout.session.completed`, `invoice.paid`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, and set `STRIPE_WEBHOOK_SECRET`.
3. Credit packs ($10/$25/$50/$100) use ad-hoc prices — nothing to create. Monthly plan credits are granted on each paid invoice. Every grant is idempotent.

## REST API

Create a key in **Settings → API keys**, then:

```bash
curl -X POST $APP_URL/api/v1/projects \
  -H "Authorization: Bearer fg_live_…" -H "Content-Type: application/json" \
  -d '{"name":"Habit tracker","prompt":"A habit tracker with streaks and a heatmap"}'

curl -N -X POST $APP_URL/api/v1/projects/$ID/messages \
  -H "Authorization: Bearer fg_live_…" -H "Content-Type: application/json" \
  -d '{"prompt":"Add a dark mode toggle","mode":"stream"}'
```

The full reference (endpoints, SSE events, errors, limits) is served at **`/docs`**.

## Skills

A skill is a markdown file with YAML front matter:

```markdown
---
name: brand-guidelines
description: Our brand colors, typography and tone of voice. Use for any UI or copy work.
---

# Brand guidelines
- Primary color: #FF6A1A …
```

Import it in **Settings → Skills** (paste, upload or URL). Built-in skills live in [`src/lib/skills/builtin.ts`](src/lib/skills/builtin.ts).

## Deployment

Forged runs agent loops in the background of a long-lived Node.js process and fans events out from memory, so deploy it on a **persistent Node server** (Docker, a VM, Railway, Fly.io, Render…) — not on short-lived serverless functions. Run a single instance, or add a shared pub/sub (e.g. Redis) to `src/lib/ai/run-registry.ts` before scaling horizontally.

```bash
docker compose --profile app up -d --build   # Postgres + the app (mounts the Docker socket for VMs)
```

The app image runs `drizzle-kit migrate` on start.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:generate` / `db:migrate` / `db:push` / `db:studio` | Drizzle |
| `npm run runtime:build` | Build the project VM image |
| `npm run test:e2e` | Playwright end-to-end tests (uses the demo model; needs Postgres, Docker optional) |
