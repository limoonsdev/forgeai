"use client";

import { useEffect, useState } from "react";
import { CheckIcon, MonitorIcon, MoonIcon, RotateCcwIcon, SunIcon } from "lucide-react";
import { toast } from "sonner";
import { ACCENTS, DEFAULT_APPEARANCE, loadAppearance, saveAppearance, type AccentPreset, type Appearance } from "@/lib/appearance";
import { useTheme, type Theme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Row, SettingsSection } from "./settings-nav";

const THEMES: { id: Theme; label: string; icon: typeof SunIcon }[] = [
  { id: "dark", label: "Dark", icon: MoonIcon },
  { id: "light", label: "Light", icon: SunIcon },
  { id: "system", label: "System", icon: MonitorIcon },
];

const CSS_EXAMPLE = `/* Example: tighter chat bubbles and a squarer prompt box */
[data-slot="chat-message"] { line-height: 1.5; }
[data-slot="prompt-box"] { border-radius: 6px; }`;

export function AppearanceView() {
  const { theme, setTheme } = useTheme();
  const [a, setA] = useState<Appearance>(DEFAULT_APPEARANCE);
  const [css, setCss] = useState("");

  useEffect(() => {
    const stored = loadAppearance();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage once
    setA(stored);
    setCss(stored.customCss);
  }, []);

  const update = (patch: Partial<Appearance>) => setA(saveAppearance({ ...a, ...patch }));

  return (
    <div className="space-y-6">
      <SettingsSection title="Theme" description="Saved in this browser only.">
        <div className="grid grid-cols-3 gap-3">
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTheme(t.id)}
              aria-pressed={theme === t.id}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border bg-background/40 p-4 text-sm transition hover:border-foreground/25",
                theme === t.id && "border-primary ring-2 ring-primary/25",
              )}
            >
              <t.icon className="size-5" />
              {t.label}
            </button>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Accent colour" description="Buttons, links, focus rings and highlights across Forged.">
        <div className="flex flex-wrap gap-3">
          {(Object.keys(ACCENTS) as AccentPreset[]).map((id) => {
            const p = ACCENTS[id];
            const active = a.accent === id;
            return (
              <button key={id} onClick={() => update({ accent: id })} aria-pressed={active} className="group flex flex-col items-center gap-1.5 text-xs" title={p.label}>
                <span
                  className={cn("flex size-11 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition", active ? "ring-2 ring-foreground" : "group-hover:ring-2 group-hover:ring-foreground/30")}
                  style={{ background: `linear-gradient(160deg, ${p.glow}, ${p.brand} 45%, ${p.hot})` }}
                >
                  {active && <CheckIcon className="size-4" style={{ color: p.fg }} />}
                </span>
                <span className={cn("text-muted-foreground", active && "text-foreground")}>{p.label}</span>
              </button>
            );
          })}
          <label className="group flex cursor-pointer flex-col items-center gap-1.5 text-xs" title="Custom colour">
            <span
              className={cn(
                "relative flex size-11 items-center justify-center overflow-hidden rounded-full border ring-offset-2 ring-offset-background transition",
                a.accent === "custom" ? "ring-2 ring-foreground" : "group-hover:ring-2 group-hover:ring-foreground/30",
              )}
              style={{ background: a.accent === "custom" ? a.customAccent : "conic-gradient(#f43f5e, #f59e0b, #22c55e, #06b6d4, #6366f1, #d946ef, #f43f5e)" }}
            >
              <input
                type="color"
                value={a.customAccent}
                onChange={(e) => update({ accent: "custom", customAccent: e.target.value })}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Pick a custom accent colour"
              />
            </span>
            <span className={cn("text-muted-foreground", a.accent === "custom" && "text-foreground")}>Custom</span>
          </label>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border bg-background/40 p-4">
          <Button variant="ember" size="sm">
            Primary action
          </Button>
          <Button variant="outline" size="sm">
            Secondary
          </Button>
          <span className="text-sm text-primary underline underline-offset-4">A link</span>
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">Badge</span>
          <span className="h-1.5 w-24 rounded-full heat-line" />
        </div>
      </SettingsSection>

      <SettingsSection title="Interface">
        <div className="divide-y">
          <Row label="Corner radius" hint={`${a.radius}px`}>
            <input
              type="range"
              min={0}
              max={20}
              step={1}
              value={a.radius}
              onChange={(e) => update({ radius: Number(e.target.value) })}
              className="w-56 accent-[var(--primary)]"
              aria-label="Corner radius"
            />
          </Row>
          <Row label="Text size" hint={`${a.scale}%`}>
            <input
              type="range"
              min={87.5}
              max={112.5}
              step={6.25}
              value={a.scale}
              onChange={(e) => update({ scale: Number(e.target.value) })}
              className="w-56 accent-[var(--primary)]"
              aria-label="Text size"
            />
          </Row>
          <Row label="Use system font" hint="Replaces Archivo with your operating system's interface font.">
            <Switch checked={a.font === "system"} onCheckedChange={(c) => update({ font: c ? "system" : "archivo" })} />
          </Row>
          <Row label="Reduce motion" hint="Turns off animations and transitions. Your OS setting is always respected too.">
            <Switch checked={a.motion === "reduced"} onCheckedChange={(c) => update({ motion: c ? "reduced" : "full" })} />
          </Row>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Custom CSS"
        description="Applied on top of Forged in this browser. Remote resources (url(), @import, fonts) are stripped."
        action={
          <Button
            size="sm"
            onClick={() => {
              update({ customCss: css });
              toast.success(css.trim() ? "Custom CSS applied" : "Custom CSS removed");
            }}
          >
            Apply
          </Button>
        }
      >
        <Textarea
          value={css}
          onChange={(e) => setCss(e.target.value)}
          rows={8}
          maxLength={20_000}
          spellCheck={false}
          placeholder={CSS_EXAMPLE}
          className="font-mono text-xs"
        />
      </SettingsSection>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            setCss("");
            setA(saveAppearance(DEFAULT_APPEARANCE));
            toast.success("Appearance reset");
          }}
        >
          <RotateCcwIcon /> Reset to defaults
        </Button>
      </div>
    </div>
  );
}
