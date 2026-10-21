"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpIcon, ImageIcon, LeafIcon, LoaderCircleIcon, PauseIcon, PlusIcon, SquareIcon, XIcon } from "lucide-react";
import { toast } from "sonner";
import type { PublicModel } from "@/lib/ai/catalog";
import { ModelPicker } from "./model-picker";
import { RichInput, type RichInputHandle } from "@/components/prompt/rich-input";
import { EnhanceButton } from "@/components/prompt/enhance-button";
import { BrandLogo } from "@/components/brand/brand-logo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ComposerHandle = { focus: () => void };

export type ComposerAttachment = { key: string; id?: string; name: string; previewUrl: string; uploading: boolean };

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";
const MAX_ATTACHMENTS = 8;

type Props = {
  value: string;
  onChange: (v: string) => void;
  /** Return false to keep the text and attachments (e.g. the request failed). */
  onSubmit: (attachmentIds: string[]) => void | boolean | Promise<void | boolean>;
  onStop?: () => void;
  onPause?: () => void;
  running?: boolean;
  disabled?: boolean;
  models?: PublicModel[];
  model?: string;
  onModelChange?: (id: string) => void;
  /** Shown instead of the model picker (landing page, signed out). */
  modelSlot?: React.ReactNode;
  tokenSaver: boolean;
  onTokenSaverChange: (v: boolean) => void;
  placeholder?: React.ReactNode;
  className?: string;
  inputClassName?: string;
  autoFocus?: boolean;
  pickerSide?: "top" | "bottom";
  signedIn?: boolean;
  projectId?: string;
  onFigmaImport?: () => void;
  submitLabel?: string;
};

export const PromptComposer = forwardRef<ComposerHandle, Props>(function PromptComposer(props, ref) {
  const router = useRouter();
  const input = useRef<RichInputHandle>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [atts, setAtts] = useState<ComposerAttachment[]>([]);
  const [dragging, setDragging] = useState(false);
  const signedIn = props.signedIn ?? true;
  useImperativeHandle(ref, () => ({ focus: () => input.current?.focus() }));

  useEffect(() => () => atts.forEach((a) => URL.revokeObjectURL(a.previewUrl)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const uploading = atts.some((a) => a.uploading);
  const canSend = (props.value.trim().length > 0 || atts.some((a) => a.id)) && !props.disabled && !props.running && !uploading;

  const addFiles = useCallback(
    async (files: File[]) => {
      if (!signedIn) {
        router.push("/signup");
        return;
      }
      const images = files.filter((f) => ACCEPT.split(",").includes(f.type));
      if (images.length < files.length) toast.error("Only PNG, JPEG, WebP and GIF images can be attached.");
      const room = MAX_ATTACHMENTS - atts.length;
      if (images.length > room) toast.error(`You can attach up to ${MAX_ATTACHMENTS} images.`);
      for (const file of images.slice(0, Math.max(0, room))) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 5 MB.`);
          continue;
        }
        const key = crypto.randomUUID();
        setAtts((s) => [...s, { key, name: file.name, previewUrl: URL.createObjectURL(file), uploading: true }]);
        const form = new FormData();
        form.append("file", file);
        if (props.projectId) form.append("projectId", props.projectId);
        try {
          const res = await fetch("/api/attachments", { method: "POST", body: form });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error?.message ?? "Upload failed");
          setAtts((s) => s.map((a) => (a.key === key ? { ...a, id: data.id, uploading: false } : a)));
        } catch (err) {
          toast.error((err as Error).message);
          setAtts((s) => s.filter((a) => a.key !== key));
        }
      }
    },
    [atts.length, props.projectId, router, signedIn],
  );

  const submit = async () => {
    if (!canSend) return;
    const ids = atts.flatMap((a) => (a.id ? [a.id] : []));
    const result = await props.onSubmit(ids);
    if (result !== false) {
      atts.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAtts([]);
    }
  };

  return (
    <div
      data-slot="prompt-box"
      className={cn(
        "relative rounded-2xl border bg-card shadow-[0_10px_40px_-24px_rgb(0_0_0/0.7)] transition-[border-color,box-shadow] focus-within:border-primary/45 focus-within:shadow-[0_10px_50px_-20px_color-mix(in_oklch,var(--brand)_45%,transparent)]",
        dragging && "border-primary/60 ring-4 ring-primary/15",
        props.className,
      )}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setDragging(false);
        void addFiles([...e.dataTransfer.files]);
      }}
    >
      {atts.length > 0 && (
        <div className="flex flex-wrap gap-2 px-3 pt-3">
          {atts.map((a) => (
            <div key={a.key} className="group relative size-14 overflow-hidden rounded-lg border bg-muted">
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={a.previewUrl} alt={a.name} className={cn("size-full object-cover", a.uploading && "opacity-40")} />
              {a.uploading && <LoaderCircleIcon className="absolute inset-0 m-auto size-4 animate-spin" />}
              <button
                type="button"
                onClick={() => {
                  URL.revokeObjectURL(a.previewUrl);
                  setAtts((s) => s.filter((x) => x.key !== a.key));
                }}
                className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded-full bg-background/90 opacity-0 shadow transition group-hover:opacity-100 focus-visible:opacity-100"
                aria-label={`Remove ${a.name}`}
              >
                <XIcon className="size-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <RichInput
        ref={input}
        value={props.value}
        onChange={props.onChange}
        onSubmit={submit}
        onPasteFiles={(f) => void addFiles(f)}
        autoFocus={props.autoFocus}
        disabled={props.disabled}
        placeholder={props.placeholder ?? "Describe what you want to build…"}
        className={cn("min-h-[3.25rem] px-4 pt-3.5 pb-1 text-[0.95rem] leading-relaxed", props.inputClassName)}
        ariaLabel="Describe what you want to build"
        testId="composer-input"
      />

      <div className="flex items-center justify-between gap-2 px-2.5 pt-1 pb-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              void addFiles([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <DropdownMenu>
            <Tooltip content="Attach">
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-accent hover:text-foreground" aria-label="Attach">
                  <PlusIcon className="size-4" />
                </button>
              </DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="start" side="top" className="w-52">
              <DropdownMenuItem onSelect={() => (signedIn ? fileInput.current?.click() : router.push("/signup"))}>
                <ImageIcon /> Images or screenshots
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => (signedIn ? (props.onFigmaImport ? props.onFigmaImport() : router.push("/settings/connectors#figma")) : router.push("/signup"))}>
                <BrandLogo id="figma" /> Figma frame
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <EnhanceButton value={props.value} onChange={props.onChange} signedIn={signedIn} disabled={props.running} />
          {props.modelSlot ?? (props.models && props.model && props.onModelChange ? <ModelPicker models={props.models} value={props.model} onChange={props.onModelChange} compact side={props.pickerSide} /> : null)}
          <Tooltip content={props.tokenSaver ? "Token saver on: lower effort, trimmed context, shorter replies" : "Token saver: spend fewer credits per message"}>
            <button
              type="button"
              onClick={() => props.onTokenSaverChange(!props.tokenSaver)}
              aria-pressed={props.tokenSaver}
              data-testid="token-saver-toggle"
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition",
                props.tokenSaver ? "border-success/40 bg-success/10 text-success" : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <LeafIcon className="size-3.5" />
              <span className="hidden sm:inline">Saver</span>
            </button>
          </Tooltip>
        </div>
        {props.running ? (
          <div className="flex items-center gap-1.5">
            {props.onPause && (
              <Tooltip content="Pause after the current step. You can resume later.">
                <button type="button" onClick={props.onPause} className="flex size-9 items-center justify-center rounded-xl border bg-background/50 transition hover:bg-accent" aria-label="Pause" data-testid="pause-button">
                  <PauseIcon className="size-4" />
                </button>
              </Tooltip>
            )}
            <Tooltip content="Stop now">
              <button type="button" onClick={props.onStop} className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background transition hover:opacity-85" aria-label="Stop" data-testid="stop-button">
                <SquareIcon className="size-3.5 fill-current" />
              </button>
            </Tooltip>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => (canSend ? submit() : input.current?.focus())}
            disabled={!canSend && !props.submitLabel}
            className={cn("btn-molten flex h-9 items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-40 disabled:shadow-none", props.submitLabel ? "pr-2.5 pl-4 text-sm" : "w-9")}
            aria-label={props.submitLabel ?? "Send"}
            data-testid="send-button"
          >
            {props.submitLabel}
            <ArrowUpIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
});
