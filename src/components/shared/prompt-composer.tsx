"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { ArrowUpIcon, LeafIcon, SquareIcon } from "lucide-react";
import type { PublicModel } from "@/lib/ai/catalog";
import { ModelPicker } from "./model-picker";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type ComposerHandle = { focus: () => void };

export const PromptComposer = forwardRef<
  ComposerHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    onStop?: () => void;
    running?: boolean;
    disabled?: boolean;
    models: PublicModel[];
    model: string;
    onModelChange: (id: string) => void;
    tokenSaver: boolean;
    onTokenSaverChange: (v: boolean) => void;
    placeholder?: string;
    minRows?: number;
    className?: string;
    autoFocus?: boolean;
    pickerSide?: "top" | "bottom";
  }
>(function PromptComposer(props, ref) {
  const textarea = useRef<HTMLTextAreaElement>(null);
  useImperativeHandle(ref, () => ({ focus: () => textarea.current?.focus() }));

  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 280)}px`;
  }, [props.value]);

  const canSend = props.value.trim().length > 0 && !props.disabled && !props.running;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card shadow-[0_8px_40px_-20px_rgba(0,0,0,0.6)] transition focus-within:border-primary/40 focus-within:shadow-[0_8px_50px_-18px_rgba(255,106,26,0.35)]",
        props.className,
      )}
    >
      <textarea
        ref={textarea}
        value={props.value}
        autoFocus={props.autoFocus}
        onChange={(e) => props.onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (canSend) props.onSubmit();
          }
        }}
        rows={props.minRows ?? 2}
        placeholder={props.placeholder ?? "Describe what you want to forge…"}
        className="block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[0.95rem] leading-relaxed outline-none placeholder:text-muted-foreground/70"
        data-testid="composer-input"
      />
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <ModelPicker models={props.models} value={props.model} onChange={props.onModelChange} compact side={props.pickerSide} />
          <Tooltip content={props.tokenSaver ? "Token saver ON — caching, trimmed context, concise replies" : "Turn on token saver to cut costs"}>
            <button
              type="button"
              onClick={() => props.onTokenSaverChange(!props.tokenSaver)}
              aria-pressed={props.tokenSaver}
              data-testid="token-saver-toggle"
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition",
                props.tokenSaver
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-500"
                  : "bg-background/40 text-muted-foreground hover:text-foreground",
              )}
            >
              <LeafIcon className="size-3.5" />
              <span className="hidden sm:inline">Saver</span>
            </button>
          </Tooltip>
        </div>
        {props.running ? (
          <button
            type="button"
            onClick={props.onStop}
            className="flex size-9 items-center justify-center rounded-xl bg-foreground text-background transition hover:opacity-85"
            aria-label="Stop"
            data-testid="stop-button"
          >
            <SquareIcon className="size-3.5 fill-current" />
          </button>
        ) : (
          <button
            type="button"
            onClick={props.onSubmit}
            disabled={!canSend}
            className="flex size-9 items-center justify-center rounded-xl bg-ember text-white shadow-[0_8px_24px_-8px_rgba(255,106,26,0.9)] transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
            aria-label="Send"
            data-testid="send-button"
          >
            <ArrowUpIcon className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
});
