import type { Metadata } from "next";
import { TemplatesGallery } from "@/components/app/templates-gallery";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 pt-12 pb-24 sm:px-6">
      <h1 className="font-display text-3xl font-bold">Templates</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">Detailed starting briefs. Pick one and the agent builds it; then change anything by chatting. You can also read and edit the brief before starting.</p>
      <TemplatesGallery />
    </main>
  );
}
