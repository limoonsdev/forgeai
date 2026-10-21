"use client";

import { useEffect, useState } from "react";

/**
 * True when the visitor asked for less motion (OS setting or Forged's appearance setting).
 * Always false during SSR and the first client render, so hydration never mismatches.
 */
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setReduced(mq.matches || document.documentElement.dataset.motion === "reduced");
    read();
    mq.addEventListener("change", read);
    window.addEventListener("forged:appearance", read);
    return () => {
      mq.removeEventListener("change", read);
      window.removeEventListener("forged:appearance", read);
    };
  }, []);
  return reduced;
}
