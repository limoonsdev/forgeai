"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Plain-text prompt input that highlights links (blue, with the site's favicon in front).
 *
 * It is a contentEditable element instead of a <textarea> so links can be styled inline. The text
 * model stays plain: the DOM is only rebuilt when the set of links changes, which keeps the
 * browser's own undo history for ordinary typing. Favicons are CSS pseudo-elements, so they never
 * become part of the text.
 */

export const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>"'`{}|\\^]+[^\s<>"'`{}|\\^.,;:!?)\]]/gi;

export type RichInputHandle = { focus: () => void; element: HTMLDivElement | null };

type Token = { text: string; url?: string; host?: string };

export function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    const raw = m[0];
    let host: string | undefined;
    try {
      host = new URL(raw.startsWith("www.") ? `https://${raw}` : raw).hostname;
    } catch {}
    out.push(host ? { text: raw, url: raw, host } : { text: raw });
    last = start + raw.length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Structure the DOM should have for `text`: link spans exactly wrapping each URL, plain text elsewhere. */
function expectedShape(text: string) {
  return tokenize(text)
    .map((t) => (t.url && t.host ? `L${t.text}` : "T"))
    .join("|");
}

function domShape(root: HTMLElement): string | null {
  const parts: string[] = [];
  for (const node of root.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (!node.nodeValue) continue;
      if (parts.at(-1) !== "T") parts.push("T");
    } else if (node instanceof HTMLElement && node.classList.contains("prompt-link") && node.childNodes.length <= 1) {
      parts.push(`L${node.textContent}`);
    } else if (node instanceof HTMLElement && node.tagName === "BR" && node === root.lastChild) {
      continue;
    } else return null; // anything else is drift (pasted markup, browser-inserted blocks)
  }
  return parts.join("|");
}

/** Reads the plain text of the editor (text nodes + <br>/block breaks). */
function readText(root: HTMLElement): string {
  let out = "";
  const walk = (node: Node, isFirst: boolean) => {
    if (node.nodeType === Node.TEXT_NODE) {
      out += node.nodeValue ?? "";
      return;
    }
    if (!(node instanceof HTMLElement)) return;
    if (node.tagName === "BR") {
      // the editor's last <br> is the browser's placeholder that keeps an empty last line caret-able
      if (node !== root.lastChild) out += "\n";
      return;
    }
    const block = node !== root && (node.tagName === "DIV" || node.tagName === "P");
    if (block && !isFirst && !out.endsWith("\n")) out += "\n";
    node.childNodes.forEach((c, i) => walk(c, i === 0));
  };
  root.childNodes.forEach((c, i) => walk(c, i === 0));
  return out;
}

function caretOffset(root: HTMLElement): number | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!root.contains(range.endContainer)) return null;
  const pre = document.createRange();
  pre.selectNodeContents(root);
  pre.setEnd(range.endContainer, range.endOffset);
  const frag = pre.cloneContents();
  const div = document.createElement("div");
  div.appendChild(frag);
  return readText(div).length;
}

function setCaret(root: HTMLElement, offset: number) {
  const sel = window.getSelection();
  if (!sel) return;
  let remaining = offset;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  let lastText: Text | null = null;
  while ((node = walker.nextNode())) {
    const len = node.nodeValue?.length ?? 0;
    lastText = node as Text;
    if (remaining <= len) {
      const r = document.createRange();
      r.setStart(node, remaining);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      return;
    }
    remaining -= len;
  }
  const r = document.createRange();
  if (lastText) r.setStart(lastText, lastText.length);
  else r.setStart(root, 0);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

function render(root: HTMLElement, text: string) {
  root.replaceChildren();
  for (const t of tokenize(text)) {
    if (t.url && t.host) {
      const a = document.createElement("span");
      a.className = "prompt-link";
      a.dataset.host = t.host;
      a.style.setProperty("--favicon", `url("/api/favicon?host=${encodeURIComponent(t.host)}")`);
      a.textContent = t.text;
      root.appendChild(a);
    } else root.appendChild(document.createTextNode(t.text));
  }
  // keep a trailing newline visible/caret-able
  if (text.endsWith("\n")) root.appendChild(document.createElement("br"));
}

export const RichInput = forwardRef<
  RichInputHandle,
  {
    value: string;
    onChange: (v: string) => void;
    onSubmit?: () => void;
    onPasteFiles?: (files: File[]) => void;
    placeholder?: React.ReactNode;
    disabled?: boolean;
    autoFocus?: boolean;
    maxLength?: number;
    className?: string;
    maxHeight?: number;
    ariaLabel?: string;
    testId?: string;
  }
>(function RichInput({ value, onChange, onSubmit, onPasteFiles, placeholder, disabled, autoFocus, maxLength = 20_000, className, maxHeight = 280, ariaLabel, testId }, ref) {
  const el = useRef<HTMLDivElement>(null);
  const composing = useRef(false);
  const lastText = useRef<string>("");

  useImperativeHandle(ref, () => ({
    focus: () => {
      const node = el.current;
      if (!node) return;
      node.focus();
      setCaret(node, readText(node).length);
    },
    get element() {
      return el.current;
    },
  }));

  // External value changes (chips, enhancer, clearing after send) rebuild the DOM.
  useLayoutEffect(() => {
    const node = el.current;
    if (!node || value === lastText.current) return;
    const hadFocus = document.activeElement === node;
    render(node, value);
    lastText.current = value;
    if (hadFocus) setCaret(node, value.length);
  }, [value]);

  useEffect(() => {
    if (autoFocus) el.current?.focus();
  }, [autoFocus]);

  const sync = useCallback(() => {
    const node = el.current;
    if (!node || composing.current) return;
    let text = readText(node);
    if (text.length > maxLength) text = text.slice(0, maxLength);
    const domText = text;
    // Rebuild only when the link structure changed; plain typing keeps the native undo stack.
    if (domShape(node) !== expectedShape(domText)) {
      const caret = caretOffset(node);
      render(node, domText);
      if (caret !== null) setCaret(node, Math.min(caret, domText.length));
    }
    lastText.current = domText;
    onChange(domText);
  }, [maxLength, onChange]);

  const insertText = (text: string) => {
    // execCommand keeps the native undo stack; fall back to a manual Range insert.
    if (!document.execCommand?.("insertText", false, text)) {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const node = document.createTextNode(text);
      r.insertNode(node);
      r.setStartAfter(node);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
      sync();
    }
  };

  return (
    <div className="relative">
      <div
        ref={el}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel ?? "Prompt"}
        aria-disabled={disabled || undefined}
        contentEditable={!disabled}
        suppressContentEditableWarning
        spellCheck
        data-testid={testId}
        data-slot="prompt-input"
        className={cn("prompt-rich scrollbar-thin overflow-y-auto break-words whitespace-pre-wrap outline-none", className)}
        style={{ maxHeight }}
        onInput={sync}
        onCompositionStart={() => (composing.current = true)}
        onCompositionEnd={() => {
          composing.current = false;
          sync();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            if (e.shiftKey) insertText("\n");
            else onSubmit?.();
          }
        }}
        onPaste={(e) => {
          e.preventDefault();
          const files = [...e.clipboardData.files];
          if (files.length && onPasteFiles) {
            onPasteFiles(files);
            return;
          }
          const text = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
          if (text) insertText(text);
        }}
        onDrop={(e) => {
          const files = [...(e.dataTransfer?.files ?? [])];
          e.preventDefault();
          if (files.length && onPasteFiles) onPasteFiles(files);
          else {
            const text = e.dataTransfer?.getData("text/plain");
            if (text) insertText(text);
          }
        }}
      />
      {!value && placeholder && <div className="pointer-events-none absolute inset-0 text-muted-foreground/75 select-none">{placeholder}</div>}
    </div>
  );
});
