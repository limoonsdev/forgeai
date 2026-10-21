import { BRAND_LOGOS } from "./brand-logos";
import { cn } from "@/lib/utils";

/** Official brand marks rendered inline (no network). Unknown ids fall back to a monogram. */
export function BrandLogo({ id, className, title, fallback }: { id: string | null | undefined; className?: string; title?: string; fallback?: string }) {
  const logo = id ? BRAND_LOGOS[id] : undefined;
  if (!logo) {
    const letter = (fallback ?? title ?? id ?? "?").slice(0, 1).toUpperCase();
    return (
      <span
        role="img"
        aria-label={title}
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-[25%] bg-foreground/12 text-[0.62em] leading-none font-bold", className)}
      >
        {letter}
      </span>
    );
  }
  return (
    <svg
      viewBox={logo.viewBox}
      className={cn("size-4 shrink-0", className)}
      fill={logo.mono ? "currentColor" : undefined}
      role="img"
      aria-label={title}
      aria-hidden={title ? undefined : true}
      dangerouslySetInnerHTML={{ __html: logo.body }}
    />
  );
}
