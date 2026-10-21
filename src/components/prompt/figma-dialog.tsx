"use client";

import Link from "next/link";
import { useState } from "react";
import { LoaderCircleIcon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type FigmaImport = { attachments: { id: string; name: string }[]; brief: string; fileName: string };

export function FigmaDialog({ open, onOpenChange, projectId, onImported }: { open: boolean; onOpenChange: (o: boolean) => void; projectId?: string; onImported: (r: FigmaImport) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; needsToken: boolean } | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/figma", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, projectId }) }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError({ message: data?.error?.message ?? "Import failed", needsToken: res?.status === 412 || res?.status === 403 });
    onImported(data);
    setUrl("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrandLogo id="figma" className="size-5" /> Import from Figma
          </DialogTitle>
          <DialogDescription>In Figma, right-click a frame → Copy/Paste as → Copy link to selection, then paste it here. Up to 4 frames are imported as images, with their texts, colours and fonts.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run();
          }}
          className="space-y-3"
        >
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.figma.com/design/…?node-id=12-34" className="font-mono text-xs" autoFocus />
          {error && (
            <p className="text-sm text-destructive">
              {error.message}{" "}
              {error.needsToken && (
                <Link href="/settings/connectors#figma" className="underline">
                  Open connectors
                </Link>
              )}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" variant="ember" disabled={busy || !url.trim()}>
              {busy && <LoaderCircleIcon className="animate-spin" />} Import
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
