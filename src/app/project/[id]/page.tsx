import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { listModels, pickDefaultModel } from "@/lib/ai/catalog";
import { loadHistory, toDTO } from "@/lib/ai/history";
import { getLatestRun } from "@/lib/ai/agent";
import { getActiveRun } from "@/lib/ai/run-registry";
import type { PlanId } from "@/lib/config";
import { getSandboxProvider } from "@/lib/sandbox";
import { listFiles } from "@/lib/server/files";
import { getOwnedProject } from "@/lib/server/projects";
import { requireUser } from "@/lib/server/session";
import { absoluteUrl } from "@/lib/utils";
import { Workspace } from "@/components/workspace/workspace";

export async function generateMetadata({ params }: PageProps<"/project/[id]">): Promise<Metadata> {
  const { id } = await params;
  const user = await requireUser();
  const p = await getOwnedProject(user.id, id);
  return { title: p?.name ?? "Project" };
}

export default async function ProjectPage({ params }: PageProps<"/project/[id]">) {
  const { id } = await params;
  const user = await requireUser(`/login?next=/project/${id}`);
  const project = await getOwnedProject(user.id, id);
  if (!project) notFound();

  const plan = user.plan as PlanId;
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, user.id));
  const [models, history, files, provider, latestRun] = await Promise.all([listModels(plan), loadHistory(project.id), listFiles(project.id), getSandboxProvider(), getLatestRun(project.id)]);
  const running = Boolean(getActiveRun(project.id));

  return (
    <Workspace
      project={{
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        model: project.model ?? pickDefaultModel(prefs?.defaultModel, plan),
        tokenSaver: project.tokenSaver ?? prefs?.tokenSaver ?? false,
      }}
      messages={history.map((m) => toDTO(m))}
      running={running}
      paused={!running && latestRun?.status === "paused"}
      emailVerified={user.emailVerified}
      models={models}
      balance={user.creditsMicros}
      files={files.map((f) => f.path)}
      sandbox={{ status: project.sandboxStatus, previewUrl: project.sandboxStatus === "running" ? project.previewUrl : null }}
      sandboxAvailable={Boolean(provider)}
      share={{
        enabled: project.shareEnabled,
        allowRemix: project.shareAllowRemix,
        url: project.shareEnabled && project.shareToken ? absoluteUrl(`/share/${project.shareToken}`) : null,
      }}
    />
  );
}
