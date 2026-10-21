import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadHistory, toDTO } from "@/lib/ai/history";
import { listFiles } from "@/lib/server/files";
import { getSharedProject } from "@/lib/server/projects";
import { getSession } from "@/lib/server/session";
import { SharedSession } from "@/components/share/shared-session";

export async function generateMetadata({ params }: PageProps<"/share/[token]">): Promise<Metadata> {
  const { token } = await params;
  const p = await getSharedProject(token);
  return p
    ? { title: `${p.name} · built with Forged`, description: p.description || "A Next.js app built on Forged.dev", robots: { index: false } }
    : { title: "Shared session" };
}

export default async function SharePage({ params }: PageProps<"/share/[token]">) {
  const { token } = await params;
  const project = await getSharedProject(token);
  if (!project) notFound();
  const [history, files, session] = await Promise.all([loadHistory(project.id), listFiles(project.id), getSession().catch(() => null)]);
  return (
    <SharedSession
      token={token}
      signedIn={Boolean(session)}
      project={{
        name: project.name,
        description: project.description,
        allowRemix: project.shareAllowRemix,
        previewUrl: project.sandboxStatus === "running" ? project.previewUrl : null,
      }}
      messages={history.map((m) => toDTO(m))}
      files={files.map((f) => f.path)}
    />
  );
}
