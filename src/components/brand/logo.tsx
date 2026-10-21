import { cn } from "@/lib/utils";

/**
 * Forged.dev brand mark — the spark above the anvil.
 * Vector redraw of /public/logo.png so it stays crisp and theme-aware.
 */
export function LogoMark({ className, glow = false }: { className?: string; glow?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" className={cn("size-8", className)} aria-hidden="true">
      <defs>
        <linearGradient id="forged-spark" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#ffb547" />
          <stop offset="45%" stopColor="#ff7a1a" />
          <stop offset="100%" stopColor="#ff3d24" />
        </linearGradient>
        <linearGradient id="forged-anvil" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#ff8a2a" />
          <stop offset="22%" stopColor="#9a4a26" />
          <stop offset="60%" style={{ stopColor: "var(--anvil-mid, #4a2f27)" }} />
          <stop offset="100%" style={{ stopColor: "var(--anvil-bottom, #2b1f1c)" }} />
        </linearGradient>
        <radialGradient id="forged-hot" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff4d6" stopOpacity="0.95" />
          <stop offset="45%" stopColor="#ffb547" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ff7a1a" stopOpacity="0" />
        </radialGradient>
        {glow && (
          <filter id="forged-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="8" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        )}
      </defs>
      <path
        filter={glow ? "url(#forged-glow)" : undefined}
        d="M128 6 C 133 46, 146 62, 176 70 C 146 78, 133 94, 128 134 C 123 94, 110 78, 80 70 C 110 62, 123 46, 128 6 Z"
        fill="url(#forged-spark)"
      />
      <path
        d="M4 120 C 28 117, 56 118, 76 121 L 252 121 L 252 141 C 229 143, 205 147, 189 157 C 173 167, 169 183, 177 200 C 183 211, 197 219, 205 232 L 151 232 C 147 214, 109 214, 105 232 L 51 232 C 59 219, 73 211, 79 200 C 87 183, 83 167, 67 157 C 49 145, 25 129, 4 120 Z"
        fill="url(#forged-anvil)"
      />
      <ellipse cx="132" cy="124" rx="58" ry="10" fill="url(#forged-hot)" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className={cn("size-7", markClassName)} />
      <span className="text-[1.05rem]">
        Forged<span className="text-muted-foreground">.dev</span>
      </span>
    </span>
  );
}
