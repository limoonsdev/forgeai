"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRightIcon, DownloadIcon, FileIcon, FolderIcon, LoaderCircleIcon, SaveIcon } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const MonacoEditor = dynamic(
  async () => {
    const mod = await import("@monaco-editor/react");
    // Monaco is self-hosted (copied to /public/monaco by the postinstall script).
    mod.loader.config({ paths: { vs: "/monaco/vs" } });
    await Promise.race([
      mod.loader.init(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Monaco load timeout")), 12_000)),
    ]);
    return mod.default;
  },
  {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      <LoaderCircleIcon className="mr-2 size-4 animate-spin" /> Loading editor…
    </div>
  ),
});

type Node = { name: string; path: string; children?: Node[] };

function buildTree(paths: string[]): Node[] {
  const root: Node[] = [];
  for (const p of paths) {
    const parts = p.split("/");
    let level = root;
    parts.forEach((part, i) => {
      const path = parts.slice(0, i + 1).join("/");
      let node = level.find((n) => n.name === part);
      if (!node) {
        node = i === parts.length - 1 ? { name: part, path } : { name: part, path, children: [] };
        level.push(node);
      }
      level = node.children ?? [];
    });
  }
  const sort = (nodes: Node[]) => {
    nodes.sort((a, b) => (a.children && !b.children ? -1 : !a.children && b.children ? 1 : a.name.localeCompare(b.name)));
    nodes.forEach((n) => n.children && sort(n.children));
    return nodes;
  };
  return sort(root);
}

function languageOf(path: string) {
  const ext = path.split(".").pop() ?? "";
  return (
    { ts: "typescript", tsx: "typescript", js: "javascript", jsx: "javascript", mjs: "javascript", json: "json", css: "css", md: "markdown", html: "html", svg: "xml", yml: "yaml", yaml: "yaml" } as Record<string, string>
  )[ext] ?? "plaintext";
}

function Tree({ nodes, selected, onSelect, depth = 0, changed }: { nodes: Node[]; selected: string | null; onSelect: (p: string) => void; depth?: number; changed: Set<string> }) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  return (
    <>
      {nodes.map((n) =>
        n.children ? (
          <div key={n.path}>
            <button
              onClick={() => setCollapsed((c) => ({ ...c, [n.path]: !c[n.path] }))}
              className="flex w-full items-center gap-1 rounded-md py-1 pr-2 text-left text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
              style={{ paddingLeft: 6 + depth * 12 }}
            >
              <ChevronRightIcon className={cn("size-3 shrink-0 transition-transform", !collapsed[n.path] && "rotate-90")} />
              <FolderIcon className="size-3.5 shrink-0 text-primary/80" />
              <span className="truncate">{n.name}</span>
            </button>
            {!collapsed[n.path] && <Tree nodes={n.children} selected={selected} onSelect={onSelect} depth={depth + 1} changed={changed} />}
          </div>
        ) : (
          <button
            key={n.path}
            onClick={() => onSelect(n.path)}
            className={cn(
              "flex w-full items-center gap-1.5 rounded-md py-1 pr-2 text-left text-[12.5px] transition hover:bg-accent",
              selected === n.path ? "bg-accent text-foreground" : "text-muted-foreground",
            )}
            style={{ paddingLeft: 18 + depth * 12 }}
          >
            <FileIcon className="size-3.5 shrink-0" />
            <span className="truncate">{n.name}</span>
            {changed.has(n.path) && <span className="ml-auto size-1.5 shrink-0 rounded-full bg-primary" />}
          </button>
        ),
      )}
    </>
  );
}

type TsDefaults = {
  setDiagnosticsOptions: (o: Record<string, unknown>) => void;
  setCompilerOptions: (o: Record<string, unknown>) => void;
};
type TsApi = { typescriptDefaults?: TsDefaults; javascriptDefaults?: TsDefaults };

/** Plain textarea editor used when Monaco cannot load (offline, blocked assets…). */
function FallbackEditor({ value, onChange, readOnly }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  return (
    <textarea
      value={value}
      readOnly={readOnly}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      className="h-full w-full resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none"
    />
  );
}

class EditorBoundary extends Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function CodePanel({
  projectId,
  files,
  selected,
  onSelect,
  changed,
  externalVersion,
  readOnly = false,
  filesBase,
}: {
  projectId: string;
  /** Base URL for file reads (defaults to the authenticated project API). */
  filesBase?: string;
  files: string[];
  selected: string | null;
  onSelect: (p: string) => void;
  changed: Set<string>;
  /** Bumped when the agent changes the selected file. */
  externalVersion: number;
  readOnly?: boolean;
}) {
  const { resolved } = useTheme();
  const [content, setContent] = useState<string>("");
  const [original, setOriginal] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const tree = useMemo(() => buildTree(files), [files]);
  const base = filesBase ?? `/api/v1/projects/${projectId}/files`;
  const dirty = content !== original;

  const load = useCallback(
    async (path: string) => {
      setLoading(true);
      const res = await fetch(`${base}/${path.split("/").map(encodeURIComponent).join("/")}`);
      const data = await res.json().catch(() => null);
      setLoading(false);
      if (!res.ok) {
        toast.error(data?.error?.message ?? "Could not open the file");
        return;
      }
      setContent(data.content);
      setOriginal(data.content);
    },
    [base],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch the newly selected file
    if (selected) void load(selected);
  }, [selected, load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the agent changed this file: reload unless the user is editing it
    if (selected && externalVersion > 0 && !dirty) void load(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalVersion]);

  const save = useCallback(async () => {
    if (!selected || !dirty || readOnly) return;
    setSaving(true);
    const res = await fetch(`/api/v1/projects/${projectId}/files/${selected.split("/").map(encodeURIComponent).join("/")}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    setSaving(false);
    if (res.ok) {
      setOriginal(content);
      toast.success(`Saved ${selected}`);
    } else toast.error("Could not save the file");
  }, [selected, dirty, readOnly, projectId, content]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  return (
    <div className="flex h-full min-h-0">
      <div className="flex w-56 shrink-0 flex-col border-r">
        <div className="flex items-center justify-between px-3 py-2 text-[11px] font-medium tracking-wider text-muted-foreground uppercase">
          Files
          {!readOnly && (
            <a href={`/api/v1/projects/${projectId}/export`} className="rounded p-1 hover:bg-accent hover:text-foreground" title="Download as zip">
              <DownloadIcon className="size-3.5" />
            </a>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-1.5 pb-3 scrollbar-thin" data-testid="file-tree">
          <Tree nodes={tree} selected={selected} onSelect={onSelect} changed={changed} />
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-9 items-center gap-2 border-b px-3 text-xs">
          <span className="truncate font-mono text-muted-foreground">{selected ?? "Select a file"}</span>
          {dirty && <span className="size-1.5 rounded-full bg-primary" />}
          {!readOnly && selected && (
            <Button size="sm" variant="ghost" className="ml-auto h-7" onClick={save} disabled={!dirty || saving}>
              {saving ? <LoaderCircleIcon className="animate-spin" /> : <SaveIcon />} Save
            </Button>
          )}
        </div>
        <div className="relative min-h-0 flex-1">
          {selected ? (
            loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
              </div>
            ) : (
              <EditorBoundary fallback={<FallbackEditor value={content} onChange={setContent} readOnly={readOnly} />}>
              <MonacoEditor
                height="100%"
                path={selected}
                language={languageOf(selected)}
                value={content}
                theme={resolved === "dark" ? "vs-dark" : "light"}
                onChange={(v) => setContent(v ?? "")}
                beforeMount={(monaco) => {
                  // The VM is the source of truth for type errors: keep syntax checks, drop unresolved-import noise.
                  const m = monaco as unknown as {
                    typescript?: TsApi;
                    languages: { typescript?: TsApi };
                  };
                  const ts = m.typescript ?? m.languages.typescript;
                  for (const defaults of [ts?.typescriptDefaults, ts?.javascriptDefaults]) {
                    defaults?.setDiagnosticsOptions({ noSemanticValidation: true, noSyntaxValidation: false });
                    defaults?.setCompilerOptions({ jsx: 4, allowJs: true, allowNonTsExtensions: true, target: 99, moduleResolution: 2, esModuleInterop: true });
                  }
                }}
                options={{
                  readOnly,
                  fontSize: 13,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  wordWrap: "on",
                  tabSize: 2,
                  padding: { top: 12 },
                  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
                }}
              />
              </EditorBoundary>
            )
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Pick a file to view its code</div>
          )}
        </div>
      </div>
    </div>
  );
}
