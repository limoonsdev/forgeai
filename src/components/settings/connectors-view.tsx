"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, ExternalLinkIcon, LoaderCircleIcon, SearchIcon } from "lucide-react";
import { CATEGORY_LABEL, CONNECTORS, type ConnectorCategory, type ConnectorDef } from "@/lib/connectors/catalog";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Saved = { connectorId: string; hint: string };

export function ConnectorsView({ initial }: { initial: Saved[] }) {
  const [saved, setSaved] = useState(initial);
  const [category, setCategory] = useState<ConnectorCategory | "all" | "connected">("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<ConnectorDef | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const categories = useMemo(() => [...new Set(CONNECTORS.map((c) => c.category))], []);
  const isOn = (id: string) => saved.some((s) => s.connectorId === id);

  const list = CONNECTORS.filter((c) => (category === "all" ? true : category === "connected" ? isOn(c.id) : c.category === category)).filter((c) =>
    query ? `${c.name} ${c.description}`.toLowerCase().includes(query.toLowerCase()) : true,
  );

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    const res = await fetch("/api/settings/connectors", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectorId: editing.id, values }) });
    const data = await res.json().catch(() => null);
    setBusy(false);
    if (!res.ok) return toast.error(data?.error?.message ?? "Couldn't save");
    setSaved(data.connectors.map((r: Saved) => ({ connectorId: r.connectorId, hint: r.hint })));
    toast.success(`${editing.name} connected`);
    setEditing(null);
  };

  const remove = async (c: ConnectorDef) => {
    const res = await fetch(`/api/settings/connectors?connectorId=${encodeURIComponent(c.id)}`, { method: "DELETE" });
    const data = await res.json().catch(() => null);
    if (res.ok) {
      setSaved(data.connectors.map((r: Saved) => ({ connectorId: r.connectorId, hint: r.hint })));
      toast.success(`${c.name} disconnected`);
      setEditing(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold">Connectors</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Add your own keys for the services your apps use. Keys are encrypted, only decrypted inside your project&apos;s VM (as environment variables) and never shown again. The agent gets a short guide for each
          connected service. Media services (fal, Replicate, Runway…) also let the agent generate images, video and audio for your project; their usage is billed by them, not by Forged.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search connectors" className="pl-9" />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all", "connected", ...categories] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn("rounded-full border px-3 py-1 text-xs transition", category === c ? "border-primary/50 bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              {c === "all" ? "All" : c === "connected" ? `Connected (${saved.length})` : CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((c) => {
          const on = isOn(c.id);
          return (
            <button
              key={c.id}
              id={c.id}
              onClick={() => {
                setValues({});
                setEditing(c);
              }}
              className={cn("flex items-start gap-3 rounded-xl border bg-card/60 p-4 text-left transition hover:border-foreground/20", on && "border-success/40")}
              data-testid={`connector-${c.id}`}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background/60">
                <BrandLogo id={c.logo} title={c.name} fallback={c.name} className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {c.name}
                  {on && (
                    <span className="flex items-center gap-1 rounded-full bg-success/15 px-1.5 py-px text-[10px] font-medium text-success">
                      <CheckIcon className="size-3" /> Connected
                    </span>
                  )}
                  {c.media && <span className="rounded-full bg-primary/10 px-1.5 py-px text-[10px] font-medium text-primary">{c.media.join(" · ")}</span>}
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-snug text-muted-foreground">{c.description}</span>
                {on && <span className="mt-1.5 block font-mono text-[10.5px] text-muted-foreground">{saved.find((s) => s.connectorId === c.id)?.hint}</span>}
              </span>
            </button>
          );
        })}
      </div>

      <Dialog open={Boolean(editing)} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BrandLogo id={editing.logo} fallback={editing.name} className="size-5" /> {editing.name}
              </DialogTitle>
              <DialogDescription>{editing.description}</DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              {editing.fields.map((f) => (
                <div key={f.name} className="space-y-2">
                  <Label htmlFor={`f-${f.name}`}>
                    {f.label} {f.optional && <span className="text-muted-foreground">(optional)</span>}
                  </Label>
                  <Input
                    id={`f-${f.name}`}
                    type={f.secret ? "password" : "text"}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder={isOn(editing.id) && f.secret ? "Saved. Type to replace." : f.placeholder}
                    value={values[f.name] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    className="font-mono text-xs"
                    required={!f.optional && !isOn(editing.id)}
                  />
                  {!editing.internal && <p className="font-mono text-[10.5px] text-muted-foreground">env: {f.name}</p>}
                </div>
              ))}
              <a href={editing.docsUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                Where do I find this? <ExternalLinkIcon className="size-3" />
              </a>
              <DialogFooter className="gap-2">
                {isOn(editing.id) && (
                  <Button type="button" variant="ghost" className="mr-auto text-destructive hover:text-destructive" onClick={() => remove(editing)}>
                    Disconnect
                  </Button>
                )}
                <Button type="submit" variant="ember" disabled={busy}>
                  {busy && <LoaderCircleIcon className="animate-spin" />} {isOn(editing.id) ? "Update" : "Connect"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
