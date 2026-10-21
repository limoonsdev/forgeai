"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0, y = 24 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: "blur(6px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  accent,
  description,
  className,
}: {
  eyebrow: string;
  title: string;
  accent?: string;
  description?: string;
  className?: string;
}) {
  return (
    <Reveal className={cn("mx-auto max-w-3xl text-center", className)}>
      <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-card/50 px-3 py-1 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 rounded-full bg-primary shadow-[0_0_10px_2px_rgba(255,122,26,0.7)]" />
        {eyebrow}
      </div>
      <h2 className="text-3xl font-semibold tracking-[-0.035em] text-balance sm:text-5xl">
        {title} {accent && <span className="font-serif font-normal italic text-gradient-ember">{accent}</span>}
      </h2>
      {description && <p className="mt-4 text-base text-pretty text-muted-foreground sm:text-lg">{description}</p>}
    </Reveal>
  );
}
