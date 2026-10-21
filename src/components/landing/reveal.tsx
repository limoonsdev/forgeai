"use client";

import { motion } from "motion/react";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { cn } from "@/lib/utils";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, className, delay = 0, y = 24 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  const reduced = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  align?: "center" | "left";
}) {
  return (
    <Reveal className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "", className)}>
      <p className="mb-4 font-mono text-xs font-medium tracking-[0.18em] text-primary uppercase">{eyebrow}</p>
      <h2 className="font-display text-3xl leading-[1.05] font-bold text-balance sm:text-5xl">{title}</h2>
      {description && <p className="mt-5 text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">{description}</p>}
    </Reveal>
  );
}
