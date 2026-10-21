import "server-only";
import type { Preferences, Project } from "@/lib/db/schema";
import type { SkillDoc } from "@/lib/skills/builtin";
import { TOKEN_SAVER_NOTE } from "./prompts";

const LANGUAGES: Record<string, string> = {
  auto: "the same language the user writes in",
  en: "English",
  fr: "French",
  es: "Spanish",
  de: "German",
  it: "Italian",
  pt: "Portuguese",
  nl: "Dutch",
  ja: "Japanese",
  zh: "Chinese",
};

export const STYLE_PRESETS: Record<string, string> = {
  modern: "Modern & clean — neutral palette, one bold accent, soft shadows, rounded corners",
  minimal: "Minimal — lots of whitespace, monochrome, crisp typography, almost no decoration",
  playful: "Playful — vivid colors, rounded shapes, friendly micro-interactions",
  corporate: "Corporate — trustworthy blues, structured grids, conservative typography",
  brutalist: "Brutalist — raw borders, high contrast, oversized type, unconventional layouts",
  luxury: "Luxury — dark backgrounds, serif headings, gold/cream accents, refined spacing",
};

/**
 * Per-turn context injected at the start of each user message.
 * It is computed once and stored with the message so the conversation is append-only.
 */
export function buildTurnContext(input: {
  project: Pick<Project, "name" | "description">;
  prefs: Pick<Preferences, "aiLanguage" | "stylePreset" | "customInstructions" | "askClarifyingQuestions" | "autoFixErrors"> | null;
  files: string[];
  skills: SkillDoc[];
  tokenSaver: boolean;
  connectors?: string[];
}) {
  const prefs = input.prefs;
  const lines: string[] = ["<forged_context>"];
  lines.push(`Project: "${input.project.name}"${input.project.description ? ` — ${input.project.description}` : ""}`);
  lines.push(`Reply language: ${LANGUAGES[prefs?.aiLanguage ?? "auto"] ?? LANGUAGES.auto}`);
  lines.push(`Preferred design style: ${STYLE_PRESETS[prefs?.stylePreset ?? "modern"] ?? STYLE_PRESETS.modern}`);
  lines.push(
    prefs?.askClarifyingQuestions === false
      ? "Clarifying questions: not allowed — make reasonable decisions yourself instead of calling ask_user."
      : "Clarifying questions: allowed — call ask_user when an important decision is genuinely ambiguous.",
  );
  lines.push(
    prefs?.autoFixErrors === false
      ? "Error fixing: report preview errors to the user instead of fixing them automatically."
      : "Error fixing: automatically fix compile/runtime errors reported by check_preview.",
  );
  if (prefs?.customInstructions?.trim()) {
    lines.push("Custom instructions from the user:");
    lines.push(prefs.customInstructions.trim().slice(0, 4000));
  }
  if (input.connectors?.length) {
    lines.push("Connected services (secrets are available as environment variables in the VM; never print them):");
    lines.push(...input.connectors);
  } else {
    lines.push("Connected services: none. If a feature needs an external API, ask the user to connect it in Settings → Connectors.");
  }
  if (input.skills.length) {
    lines.push("Enabled skills (call load_skill with the name to read one):");
    for (const s of input.skills) lines.push(`- ${s.slug}: ${s.description}`);
  }
  const files = input.files;
  lines.push(`Project files (${files.length}):`);
  const shown = input.tokenSaver ? files.slice(0, 150) : files.slice(0, 400);
  lines.push(...shown);
  if (shown.length < files.length) lines.push(`… and ${files.length - shown.length} more (use list_files)`);
  if (input.tokenSaver) lines.push(TOKEN_SAVER_NOTE);
  lines.push("</forged_context>");
  return lines.join("\n");
}
