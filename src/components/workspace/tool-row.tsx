"use client";

import { useState } from "react";
import {
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  FileCode2Icon,
  FilePenLineIcon,
  FileSearchIcon,
  FolderTreeIcon,
  GlobeIcon,
  ListChecksIcon,
  LoaderCircleIcon,
  MessageCircleQuestionIcon,
  PackageIcon,
  PencilLineIcon,
  ScrollTextIcon,
  TagIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { describeToolCall } from "@/lib/ai/tools";
import type { ToolResultPart } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  list_files: FolderTreeIcon,
  read_file: BookOpenIcon,
  write_file: FileCode2Icon,
  edit_file: FilePenLineIcon,
  delete_file: Trash2Icon,
  rename_file: PencilLineIcon,
  search_files: FileSearchIcon,
  install_packages: PackageIcon,
  run_command: TerminalIcon,
  check_preview: GlobeIcon,
  read_logs: ScrollTextIcon,
  ask_user: MessageCircleQuestionIcon,
  update_plan: ListChecksIcon,
  load_skill: BookOpenIcon,
  set_project_info: TagIcon,
};

/** Extracts what we can from a partially streamed JSON tool input. */
export function peekInput(json: string): Record<string, unknown> {
  try {
    return JSON.parse(json);
  } catch {
    const path = json.match(/"path"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1];
    const lines = (json.match(/\\n/g) ?? []).length;
    return { ...(path ? { path } : {}), __lines: lines };
  }
}

export function ToolRow({
  name,
  input,
  result,
  streaming = false,
  onOpenFile,
}: {
  name: string;
  input: Record<string, unknown>;
  result?: ToolResultPart;
  streaming?: boolean;
  onOpenFile?: (path: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const Icon = ICONS[name] ?? TerminalIcon;
  const label = describeToolCall(name, input);
  const pending = !result || result.pending;
  const isFile = (name === "write_file" || name === "edit_file") && typeof input.path === "string";
  const lines =
    typeof input.content === "string" ? input.content.split("\n").length : typeof input.__lines === "number" ? input.__lines : undefined;
  const status = typeof result?.meta?.status === "number" ? (result.meta.status as number) : undefined;

  return (
    <div className={cn("group rounded-lg border bg-background/40 text-[12.5px] transition", result?.isError && "border-destructive/30")} data-testid="tool-row">
      <div className="flex items-center gap-2 px-2.5 py-1.5">
        <span className="flex size-5 shrink-0 items-center justify-center">
          {pending && (streaming || !result) && name !== "ask_user" ? (
            <LoaderCircleIcon className="size-3.5 animate-spin text-primary" />
          ) : result?.isError ? (
            <XIcon className="size-3.5 text-destructive" />
          ) : (
            <Icon className="size-3.5 text-primary" />
          )}
        </span>
        {isFile && onOpenFile ? (
          <button className="min-w-0 truncate text-left hover:underline" onClick={() => onOpenFile(input.path as string)}>
            {streaming && name === "write_file" ? `Writing ${input.path as string}` : label}
          </button>
        ) : (
          <span className="min-w-0 truncate">{streaming && name === "write_file" && !input.path ? "Writing a file…" : label}</span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[10.5px] text-muted-foreground">
          {lines !== undefined && name === "write_file" && <span>{lines} lines</span>}
          {status !== undefined && <span className={status < 400 ? "text-emerald-500" : "text-destructive"}>{status}</span>}
          {result && !result.pending && !result.isError && name !== "write_file" && name !== "check_preview" && <CheckIcon className="size-3 text-emerald-500" />}
          {result && !result.pending && result.output && (
            <button onClick={() => setOpen((o) => !o)} className="rounded p-0.5 hover:bg-accent" aria-label="Show output">
              <ChevronRightIcon className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            </button>
          )}
        </span>
      </div>
      {open && result?.output && (
        <pre className="max-h-64 overflow-auto border-t px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground scrollbar-thin">
          {result.output}
        </pre>
      )}
    </div>
  );
}
