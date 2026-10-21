import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { ensureSandbox, getLiveSandbox, touchSandbox, type SandboxHandle } from "@/lib/sandbox";
import { deleteFile, FileError, getAllFiles, listFiles, readFile, renameFile, writeFiles } from "@/lib/server/files";
import { findSkill, getEnabledSkills } from "@/lib/skills";
import { toolSchemas, type ToolName } from "./tools";
import type { PollInput, RunEvent, ToolCallPart, ToolResultPart } from "./types";

export type ToolContext = {
  projectId: string;
  userId: string;
  emit: (e: RunEvent) => void;
  signal: AbortSignal;
};

type Outcome = { output: string; isError?: boolean; pending?: boolean; meta?: Record<string, unknown> };

const PKG_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*(@[a-z0-9^~.*<>=|\- ]+)?$/i;
const ALLOWED_COMMANDS = new Set(["npm", "npx", "node", "ls", "cat", "grep", "find", "head", "tail", "wc", "pwd", "echo", "tsc", "sed", "sort", "uniq"]);

function truncate(s: string, max = 12_000) {
  return s.length > max ? `${s.slice(0, max)}\n… [truncated ${s.length - max} characters]` : s;
}

function stripAnsi(s: string) {
  return s.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

async function sandboxFor(ctx: ToolContext): Promise<SandboxHandle | null> {
  return ensureSandbox(ctx.projectId, (e) => ctx.emit({ type: "sandbox", ...e }));
}

/** Pulls files created or modified inside the VM by a command back into the database. */
async function pullChangedFiles(ctx: ToolContext, sbx: SandboxHandle, marker: string) {
  const r = await sbx.exec(
    `find . -type f -newer ${marker} -not -path './node_modules/*' -not -path './.next/*' -not -path './.git/*' -not -name 'package-lock.json' -not -name 'next-env.d.ts' -size -512k | head -200`,
    { timeoutMs: 20_000 },
  );
  const paths = r.stdout
    .split("\n")
    .map((l) => l.trim().replace(/^\.\//, ""))
    .filter(Boolean);
  const files: { path: string; content: string }[] = [];
  for (const p of paths) {
    const content = await sbx.readFile(p);
    if (content !== null && !content.includes("\u0000")) files.push({ path: p, content });
  }
  if (files.length) {
    await writeFiles(ctx.projectId, files, { sync: false });
    ctx.emit({ type: "files_changed", paths: files.map((f) => f.path) });
  }
  return files.map((f) => f.path);
}

async function resolveLatestVersion(pkg: string) {
  const name = pkg.replace(/(?!^)@.*$/, "");
  const res = await fetch(`https://registry.npmjs.org/${name.replace("/", "%2F")}/latest`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Package ${name} not found on npm`);
  const json = (await res.json()) as { version: string };
  return { name, version: `^${json.version}` };
}

function extractErrors(log: string) {
  const lines = stripAnsi(log).split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/warn|retrying|failed to download .*google fonts|using fallback font/i.test(line)) continue;
    if (/(⨯|failed to compile|module not found|cannot find module|unhandled|^\s*error\b|\berror:|TypeError|ReferenceError|SyntaxError|is not defined|Unexpected token)/i.test(line)) {
      out.push(...lines.slice(i, i + 6));
      i += 5;
    }
  }
  return [...new Set(out)].join("\n").trim();
}

async function execute(ctx: ToolContext, name: ToolName, input: unknown): Promise<Outcome> {
  switch (name) {
    case "list_files": {
      const files = await listFiles(ctx.projectId);
      return { output: files.map((f) => `${f.path} (${f.size} B)`).join("\n") || "(no files)" };
    }
    case "read_file": {
      const { path, start_line, end_line } = toolSchemas.read_file.parse(input);
      const content = await readFile(ctx.projectId, path);
      if (content === null) return { output: `File not found: ${path}`, isError: true };
      if (start_line || end_line) {
        const lines = content.split("\n");
        const s = Math.max(1, start_line ?? 1);
        const e = Math.min(lines.length, end_line ?? lines.length);
        return { output: lines.slice(s - 1, e).join("\n") };
      }
      return { output: truncate(content, 60_000) };
    }
    case "write_file": {
      const { path, content } = toolSchemas.write_file.parse(input);
      const [saved] = await writeFiles(ctx.projectId, [{ path, content }]);
      ctx.emit({ type: "files_changed", paths: [saved] });
      if (saved === "package.json") {
        const sbx = await getLiveSandbox(ctx.projectId);
        if (sbx) await sbx.exec("npm install --no-audit --no-fund --loglevel=error", { timeoutMs: 300_000 });
      }
      return { output: `Wrote ${saved} (${content.split("\n").length} lines).`, meta: { path: saved, lines: content.split("\n").length } };
    }
    case "edit_file": {
      const { path, edits } = toolSchemas.edit_file.parse(input);
      const current = await readFile(ctx.projectId, path);
      if (current === null) return { output: `File not found: ${path}. Use write_file to create it.`, isError: true };
      let next = current;
      for (const [i, edit] of edits.entries()) {
        const count = next.split(edit.old_string).length - 1;
        if (count === 0)
          return {
            output: `Edit ${i + 1} failed: old_string not found in ${path}. No changes were applied. Read the file again and copy the exact text.`,
            isError: true,
          };
        if (count > 1 && !edit.replace_all)
          return {
            output: `Edit ${i + 1} failed: old_string appears ${count} times in ${path}. Add surrounding context to make it unique, or set replace_all. No changes were applied.`,
            isError: true,
          };
        next = edit.replace_all ? next.split(edit.old_string).join(edit.new_string) : next.replace(edit.old_string, () => edit.new_string);
      }
      const [saved] = await writeFiles(ctx.projectId, [{ path, content: next }]);
      ctx.emit({ type: "files_changed", paths: [saved] });
      return { output: `Applied ${edits.length} edit${edits.length > 1 ? "s" : ""} to ${saved}.`, meta: { path: saved, edits: edits.length } };
    }
    case "delete_file": {
      const { path } = toolSchemas.delete_file.parse(input);
      const removed = await deleteFile(ctx.projectId, path);
      ctx.emit({ type: "files_changed", paths: [], deleted: [removed] });
      return { output: `Deleted ${removed}.` };
    }
    case "rename_file": {
      const { from, to } = toolSchemas.rename_file.parse(input);
      const r = await renameFile(ctx.projectId, from, to);
      ctx.emit({ type: "files_changed", paths: [r.to], deleted: [r.from] });
      return { output: `Renamed ${r.from} → ${r.to}.` };
    }
    case "search_files": {
      const { query, path_prefix } = toolSchemas.search_files.parse(input);
      const q = query.toLowerCase();
      const hits: string[] = [];
      for (const f of await getAllFiles(ctx.projectId)) {
        if (path_prefix && !f.path.startsWith(path_prefix)) continue;
        const lines = f.content.split("\n");
        lines.forEach((line, i) => {
          if (hits.length < 120 && line.toLowerCase().includes(q)) hits.push(`${f.path}:${i + 1}: ${line.trim().slice(0, 200)}`);
        });
      }
      return { output: hits.length ? hits.join("\n") : `No matches for "${query}".` };
    }
    case "install_packages": {
      const { packages, dev } = toolSchemas.install_packages.parse(input);
      const bad = packages.filter((p) => !PKG_RE.test(p));
      if (bad.length) return { output: `Invalid package name(s): ${bad.join(", ")}`, isError: true };
      const sbx = await sandboxFor(ctx);
      if (sbx) {
        const r = await sbx.exec(`npm install --no-audit --no-fund --loglevel=error ${dev ? "--save-dev " : ""}${packages.join(" ")}`, {
          timeoutMs: 300_000,
        });
        if (r.exitCode !== 0) return { output: `npm install failed:\n${truncate(stripAnsi(r.stderr || r.stdout), 4000)}`, isError: true };
        const pkg = await sbx.readFile("package.json");
        if (pkg) {
          await writeFiles(ctx.projectId, [{ path: "package.json", content: pkg }], { sync: false });
          ctx.emit({ type: "files_changed", paths: ["package.json"] });
        }
        return { output: `Installed ${packages.join(", ")}${dev ? " (dev)" : ""}.` };
      }
      // No VM available: record the dependency in package.json so it installs on the next boot / export.
      const raw = (await readFile(ctx.projectId, "package.json")) ?? "{}";
      const json = JSON.parse(raw) as Record<string, Record<string, string>>;
      const key = dev ? "devDependencies" : "dependencies";
      json[key] ??= {};
      for (const p of packages) {
        const { name, version } = await resolveLatestVersion(p);
        json[key][name] = version;
      }
      json[key] = Object.fromEntries(Object.entries(json[key]).sort(([a], [b]) => a.localeCompare(b)));
      await writeFiles(ctx.projectId, [{ path: "package.json", content: `${JSON.stringify(json, null, 2)}\n` }]);
      ctx.emit({ type: "files_changed", paths: ["package.json"] });
      return { output: `Added ${packages.join(", ")} to package.json (the VM is offline; they will install on next boot).` };
    }
    case "run_command": {
      const { command } = toolSchemas.run_command.parse(input);
      const segments = command.split(/\|\||&&|\||;/).map((s) => s.trim()).filter(Boolean);
      for (const seg of segments) {
        const bin = seg.split(/\s+/)[0];
        if (!ALLOWED_COMMANDS.has(bin)) return { output: `Command "${bin}" is not allowed. Allowed: ${[...ALLOWED_COMMANDS].join(", ")}.`, isError: true };
      }
      if (/[`$]\(|`|\bsudo\b|\brm\s+-rf\s+\/(\s|$)/.test(command)) return { output: "This command pattern is not allowed.", isError: true };
      const sbx = await sandboxFor(ctx);
      if (!sbx) return { output: "The project VM is not available on this server.", isError: true };
      const marker = `/tmp/forged-marker-${Date.now()}`;
      await sbx.exec(`touch ${marker}`, { timeoutMs: 5000 });
      const r = await sbx.exec(command, { timeoutMs: 180_000 });
      const changed = await pullChangedFiles(ctx, sbx, marker).catch(() => []);
      const out = truncate(stripAnsi([r.stdout, r.stderr].filter(Boolean).join("\n")), 10_000);
      return {
        output: `Exit code ${r.exitCode}\n${out || "(no output)"}${changed.length ? `\n\nFiles changed in the VM and saved: ${changed.join(", ")}` : ""}`,
        isError: r.exitCode !== 0,
      };
    }
    case "check_preview": {
      const { path } = toolSchemas.check_preview.parse(input);
      const route = path && path.startsWith("/") ? path : "/";
      const sbx = await sandboxFor(ctx);
      if (!sbx) return { output: "Preview VM is not available on this server — verification skipped. Review the code carefully instead." };
      await touchSandbox(ctx.projectId);
      let res = await sbx.httpGet(route, 90_000);
      if (res.status === 0) {
        await sbx.startDevServer();
        await new Promise((r) => setTimeout(r, 4000));
        res = await sbx.httpGet(route, 90_000);
      }
      const logs = await sbx.logs(120);
      const errors = extractErrors(logs);
      ctx.emit({ type: "sandbox", status: "running", previewUrl: sbx.previewUrl, message: "refresh" });
      if (res.status === 0) return { output: `The dev server is not responding.\nRecent logs:\n${truncate(stripAnsi(logs), 6000)}`, isError: true };
      const bodyError =
        res.status >= 400
          ? stripAnsi(res.body)
              .replace(/<script[\s\S]*?<\/script>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .slice(0, 2000)
          : "";
      const ok = res.status < 400 && !errors;
      return {
        output: ok
          ? `GET ${route} → ${res.status}. The page compiled and rendered without errors.`
          : `GET ${route} → ${res.status}.${errors ? `\nErrors from the dev server:\n${truncate(errors, 6000)}` : ""}${bodyError ? `\nResponse: ${bodyError}` : ""}`,
        isError: !ok && res.status >= 500,
        meta: { status: res.status },
      };
    }
    case "read_logs": {
      const { lines } = toolSchemas.read_logs.parse(input);
      const sbx = await sandboxFor(ctx);
      if (!sbx) return { output: "The project VM is not available on this server.", isError: true };
      const logs = stripAnsi(await sbx.logs(lines ?? 120));
      return { output: truncate(logs, 15_000) || "(no logs yet)" };
    }
    case "ask_user": {
      const parsed = toolSchemas.ask_user.parse(input);
      const poll: PollInput = {
        question: parsed.question,
        options: parsed.options,
        multiSelect: parsed.multi_select ?? false,
        allowCustom: parsed.allow_custom ?? true,
      };
      return { output: "", pending: true, meta: { poll } };
    }
    case "update_plan": {
      const { items } = toolSchemas.update_plan.parse(input);
      ctx.emit({ type: "plan", items });
      return { output: "Plan updated.", meta: { items } };
    }
    case "load_skill": {
      const { name: skillName } = toolSchemas.load_skill.parse(input);
      const skill = await findSkill(ctx.userId, skillName);
      if (!skill) {
        const all = await getEnabledSkills(ctx.userId);
        return { output: `Skill "${skillName}" not found. Enabled skills: ${all.map((s) => s.slug).join(", ") || "none"}.`, isError: true };
      }
      return { output: `# Skill: ${skill.name}\n\n${skill.content}` };
    }
    case "set_project_info": {
      const { name: projectName, description } = toolSchemas.set_project_info.parse(input);
      const patch: { name?: string; description?: string; updatedAt: Date } = { updatedAt: new Date() };
      if (projectName) patch.name = projectName.trim();
      if (description !== undefined) patch.description = description.trim();
      await db.update(projects).set(patch).where(eq(projects.id, ctx.projectId));
      ctx.emit({ type: "project", name: patch.name, description: patch.description });
      return { output: "Project info updated." };
    }
  }
}

export async function executeToolCall(ctx: ToolContext, call: ToolCallPart): Promise<ToolResultPart> {
  const base = { type: "tool_result" as const, toolCallId: call.id, name: call.name };
  if (!(call.name in toolSchemas)) return { ...base, output: `Unknown tool "${call.name}".`, isError: true };
  const name = call.name as ToolName;
  if ("__invalid_json" in call.input) {
    return { ...base, output: JSON.stringify({ INVALID_JSON: String(call.input.__invalid_json).slice(0, 500) }), isError: true };
  }
  // Inputs streamed eagerly can be silently truncated: validate before running anything.
  const check = toolSchemas[name].safeParse(call.input);
  if (!check.success) {
    return {
      ...base,
      output: `Invalid input for ${name}: ${check.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ")}`,
      isError: true,
    };
  }
  try {
    const r = await execute(ctx, name, check.data);
    return { ...base, output: r.output, isError: r.isError, pending: r.pending, meta: r.meta };
  } catch (err) {
    const msg = err instanceof FileError ? err.message : `${name} failed: ${(err as Error).message}`;
    return { ...base, output: msg, isError: true };
  }
}
