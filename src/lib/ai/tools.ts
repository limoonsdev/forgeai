import { z } from "zod";
import type { ToolDefinition } from "./types";

/**
 * The tool set is identical for every request (part of the cached prefix).
 * Validation schemas guard against truncated/invalid inputs from eager input streaming.
 */

const path = z.string().min(1).max(300);

export const toolSchemas = {
  list_files: z.object({}).passthrough(),
  read_file: z.object({ path, start_line: z.number().int().positive().optional(), end_line: z.number().int().positive().optional() }),
  write_file: z.object({ path, content: z.string() }),
  edit_file: z.object({
    path,
    edits: z
      .array(z.object({ old_string: z.string().min(1), new_string: z.string(), replace_all: z.boolean().optional() }))
      .min(1),
  }),
  delete_file: z.object({ path }),
  rename_file: z.object({ from: path, to: path }),
  search_files: z.object({ query: z.string().min(1).max(200), path_prefix: z.string().optional() }),
  install_packages: z.object({ packages: z.array(z.string().min(1).max(100)).min(1).max(20), dev: z.boolean().optional() }),
  run_command: z.object({ command: z.string().min(1).max(500) }),
  check_preview: z.object({ path: z.string().optional() }),
  read_logs: z.object({ lines: z.number().int().min(10).max(400).optional() }),
  ask_user: z.object({
    question: z.string().min(3).max(500),
    options: z.array(z.object({ label: z.string().min(1).max(120), description: z.string().max(300).optional() })).min(2).max(6),
    multi_select: z.boolean().optional(),
    allow_custom: z.boolean().optional(),
  }),
  update_plan: z.object({
    items: z.array(z.object({ title: z.string().min(1).max(200), status: z.enum(["pending", "in_progress", "done"]) })).min(1).max(20),
  }),
  load_skill: z.object({ name: z.string().min(1).max(100) }),
  set_project_info: z.object({ name: z.string().min(1).max(60).optional(), description: z.string().max(300).optional() }),
  web_search: z.object({ query: z.string().min(2).max(300) }),
  web_fetch: z.object({ url: z.string().url().max(2000) }),
  spawn_agents: z.object({
    agents: z
      .array(
        z.object({
          name: z.string().min(1).max(40),
          task: z.string().min(10).max(4000),
          files: z.array(path).max(40).optional(),
        }),
      )
      .min(1)
      .max(6),
  }),
  notify_user: z.object({ message: z.string().min(1).max(1000) }),
  browser: z.object({
    action: z.enum(["open", "click", "type", "press", "scroll", "screenshot"]),
    path: z.string().max(500).optional(),
    x: z.number().min(0).max(4000).optional(),
    y: z.number().min(0).max(4000).optional(),
    text: z.string().max(2000).optional(),
    key: z.string().max(40).optional(),
    dy: z.number().min(-5000).max(5000).optional(),
  }),
  generate_media: z.object({
    connector: z.string().min(1).max(40),
    kind: z.enum(["image", "video", "audio"]),
    prompt: z.string().min(3).max(4000),
    path: path,
    model: z.string().max(120).optional(),
    aspect_ratio: z.string().max(10).optional(),
    duration_seconds: z.number().min(1).max(20).optional(),
  }),
  audit_page: z.object({ path: z.string().max(500).optional() }),
} as const;

export type ToolName = keyof typeof toolSchemas;

export const TOOLS: ToolDefinition[] = [
  {
    name: "list_files",
    description: "List every file in the project with its size in bytes.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "read_file",
    description: "Read a project file. Optionally restrict to a 1-based inclusive line range for large files.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Project-relative path, e.g. app/page.tsx" },
        start_line: { type: "integer" },
        end_line: { type: "integer" },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "write_file",
    description:
      "Create a file or overwrite it with the full new content. Use for new files and complete rewrites. Paths are relative to the project root (e.g. app/page.tsx, components/hero.tsx).",
    streamsLargeInput: true,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        content: { type: "string", description: "Complete file content" },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "edit_file",
    description:
      "Apply exact search-and-replace edits to an existing file. Each old_string must match the current file exactly (including whitespace) and be unique unless replace_all is true. Edits apply in order.",
    streamsLargeInput: true,
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              old_string: { type: "string" },
              new_string: { type: "string" },
              replace_all: { type: "boolean" },
            },
            required: ["old_string", "new_string"],
            additionalProperties: false,
          },
        },
      },
      required: ["path", "edits"],
      additionalProperties: false,
    },
  },
  {
    name: "delete_file",
    description: "Delete a file from the project.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"], additionalProperties: false },
  },
  {
    name: "rename_file",
    description: "Move or rename a file.",
    inputSchema: {
      type: "object",
      properties: { from: { type: "string" }, to: { type: "string" } },
      required: ["from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "search_files",
    description: "Search all project files for a literal string (case-insensitive). Returns matching lines with line numbers.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, path_prefix: { type: "string", description: "Only search under this folder" } },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "install_packages",
    description: "Install npm packages in the project VM and record them in package.json. Example: [\"@tanstack/react-query\"].",
    inputSchema: {
      type: "object",
      properties: {
        packages: { type: "array", items: { type: "string" } },
        dev: { type: "boolean", description: "Install as devDependencies" },
      },
      required: ["packages"],
      additionalProperties: false,
    },
  },
  {
    name: "run_command",
    description:
      "Run a shell command in the project VM (working directory is the project root). Allowed: npm, npx, ls, cat, grep, find, head, tail, wc, pwd, echo, tsc. Use it for checks such as `npx tsc --noEmit` or scaffolding commands.",
    inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"], additionalProperties: false },
  },
  {
    name: "check_preview",
    description:
      "Request a route from the running Next.js dev server and report the HTTP status plus any compile or runtime errors. Call after making changes.",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "Route to check, defaults to /" } },
      additionalProperties: false,
    },
  },
  {
    name: "read_logs",
    description: "Read the latest output of the Next.js dev server running in the VM.",
    inputSchema: { type: "object", properties: { lines: { type: "integer" } }, additionalProperties: false },
  },
  {
    name: "ask_user",
    description:
      "Ask the user a multiple-choice question (rendered as an interactive poll) and wait for the answer. Use for important ambiguous decisions only. Stop working after calling it — the answer arrives as the tool result.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string" },
        options: {
          type: "array",
          items: {
            type: "object",
            properties: { label: { type: "string" }, description: { type: "string" } },
            required: ["label"],
            additionalProperties: false,
          },
        },
        multi_select: { type: "boolean", description: "Allow selecting several options" },
        allow_custom: { type: "boolean", description: "Let the user type their own answer (default true)" },
      },
      required: ["question", "options"],
      additionalProperties: false,
    },
  },
  {
    name: "update_plan",
    description: "Create or update the visible task checklist for the current request.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { title: { type: "string" }, status: { type: "string", enum: ["pending", "in_progress", "done"] } },
            required: ["title", "status"],
            additionalProperties: false,
          },
        },
      },
      required: ["items"],
      additionalProperties: false,
    },
  },
  {
    name: "load_skill",
    description: "Load the full instructions of one of the enabled skills listed in the context block.",
    inputSchema: { type: "object", properties: { name: { type: "string" } }, required: ["name"], additionalProperties: false },
  },
  {
    name: "web_search",
    description: "Search the web. Returns titles, URLs and snippets. Use for documentation, current library APIs or facts about the user's business.",
    inputSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"], additionalProperties: false },
  },
  {
    name: "web_fetch",
    description: "Read a public web page (or a URL the user pasted) as plain text: title, headings, paragraphs and links.",
    inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"], additionalProperties: false },
  },
  {
    name: "spawn_agents",
    description:
      "Delegate independent pieces of work to sub-agents that run in parallel (each with its own context and file tools, no access to the preview). Give each a clear task and the files it owns; files owned by one agent cannot be written by another. You get a summary from each when they finish. Use for large multi-page builds, not for small edits.",
    inputSchema: {
      type: "object",
      properties: {
        agents: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Short role name, e.g. 'pricing-page'" },
              task: { type: "string", description: "Self-contained instructions, including design decisions to follow" },
              files: { type: "array", items: { type: "string" }, description: "Files this agent owns and may create or edit" },
            },
            required: ["name", "task"],
            additionalProperties: false,
          },
        },
      },
      required: ["agents"],
      additionalProperties: false,
    },
  },
  {
    name: "notify_user",
    description: "Send a short message to the user's notification channels (Discord, Slack, Telegram, push, email). Use only for things worth interrupting them for.",
    inputSchema: { type: "object", properties: { message: { type: "string" } }, required: ["message"], additionalProperties: false },
  },
  {
    name: "browser",
    description:
      "Control a real browser pointed at the running preview, with a visible cursor the user can watch. Actions: open (path), click (x,y in pixels of the last screenshot), type (text into the focused element), press (key, e.g. Enter), scroll (dy pixels), screenshot. Every action returns a screenshot (1280x800). Use it to check layouts and test interactions.",
    inputSchema: {
      type: "object",
      properties: {
        action: { type: "string", enum: ["open", "click", "type", "press", "scroll", "screenshot"] },
        path: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        text: { type: "string" },
        key: { type: "string" },
        dy: { type: "number" },
      },
      required: ["action"],
      additionalProperties: false,
    },
  },
  {
    name: "generate_media",
    description:
      "Generate an image, video or audio file with one of the user's connected media providers (see the context block) and save it into the project (for example public/media/hero.mp4). Reference it in code as /media/hero.mp4.",
    inputSchema: {
      type: "object",
      properties: {
        connector: { type: "string", description: "Connected provider id, e.g. fal, replicate, openai, elevenlabs" },
        kind: { type: "string", enum: ["image", "video", "audio"] },
        prompt: { type: "string" },
        path: { type: "string", description: "Destination inside the project, under public/" },
        model: { type: "string", description: "Optional provider model id" },
        aspect_ratio: { type: "string", description: "e.g. 16:9, 1:1, 9:16" },
        duration_seconds: { type: "number" },
      },
      required: ["connector", "kind", "prompt", "path"],
      additionalProperties: false,
    },
  },
  {
    name: "audit_page",
    description: "Run an automated audit (SEO, accessibility, performance, best practices) of a route of the running preview and get the list of issues.",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, additionalProperties: false },
  },
  {
    name: "set_project_info",
    description: "Set the project's display name (2–4 words) and a one-sentence description.",
    inputSchema: {
      type: "object",
      properties: { name: { type: "string" }, description: { type: "string" } },
      additionalProperties: false,
    },
  },
];

/** Short human label for the activity feed. */
export function describeToolCall(name: string, input: Record<string, unknown>): string {
  const p = typeof input.path === "string" ? input.path : "";
  switch (name) {
    case "list_files":
      return "Listed files";
    case "read_file":
      return `Read ${p}`;
    case "write_file":
      return `Wrote ${p}`;
    case "edit_file":
      return `Edited ${p}`;
    case "delete_file":
      return `Deleted ${p}`;
    case "rename_file":
      return `Renamed ${String(input.from ?? "")} → ${String(input.to ?? "")}`;
    case "search_files":
      return `Searched “${String(input.query ?? "")}”`;
    case "install_packages":
      return `Installed ${Array.isArray(input.packages) ? input.packages.join(", ") : "packages"}`;
    case "run_command":
      return `Ran \`${String(input.command ?? "")}\``;
    case "check_preview":
      return `Checked preview ${typeof input.path === "string" ? input.path : "/"}`;
    case "read_logs":
      return "Read dev server logs";
    case "ask_user":
      return "Asked you a question";
    case "update_plan":
      return "Updated the plan";
    case "load_skill":
      return `Loaded skill ${String(input.name ?? "")}`;
    case "set_project_info":
      return `Named project ${String(input.name ?? "")}`;
    case "web_search":
      return `Searched the web for “${String(input.query ?? "")}”`;
    case "web_fetch":
      return `Read ${String(input.url ?? "a web page")}`;
    case "spawn_agents":
      return `Started ${Array.isArray(input.agents) ? input.agents.length : ""} sub-agents`;
    case "notify_user":
      return "Sent you a notification";
    case "browser":
      return `Browser: ${String(input.action ?? "")}${input.path ? ` ${String(input.path)}` : ""}`;
    case "generate_media":
      return `Generated ${String(input.kind ?? "media")} ${String(input.path ?? "")}`;
    case "audit_page":
      return `Audited ${typeof input.path === "string" ? input.path : "/"}`;
    default:
      return name;
  }
}

/** Tools sub-agents may use (no preview, no polls, no package installs). */
export const SUBAGENT_TOOL_NAMES = new Set(["list_files", "read_file", "write_file", "edit_file", "delete_file", "search_files", "load_skill", "web_search", "web_fetch"]);
export const SUBAGENT_TOOLS = TOOLS.filter((t) => SUBAGENT_TOOL_NAMES.has(t.name));
