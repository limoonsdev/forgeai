"use client";

import { useEffect, useState } from "react";

/** Cycles through phrases with a typing/deleting effect (used for prompt placeholders). */
export function useTypewriter(phrases: string[], { typeMs = 38, deleteMs = 16, holdMs = 2200, enabled = true } = {}) {
  const [text, setText] = useState("");
  const [index, setIndex] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!enabled || !phrases.length) return;
    const full = phrases[index % phrases.length];
    let timer: ReturnType<typeof setTimeout>;
    if (!deleting && text === full) timer = setTimeout(() => setDeleting(true), holdMs);
    else if (deleting && text === "") {
      timer = setTimeout(() => {
        setDeleting(false);
        setIndex((i) => i + 1);
      }, 250);
    } else {
      timer = setTimeout(
        () => setText(deleting ? full.slice(0, text.length - 1) : full.slice(0, text.length + 1)),
        deleting ? deleteMs : typeMs,
      );
    }
    return () => clearTimeout(timer);
  }, [text, deleting, index, phrases, typeMs, deleteMs, holdMs, enabled]);

  return text;
}
