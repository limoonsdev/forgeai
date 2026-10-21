import type { Metadata } from "next";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { FolderOpenIcon } from "lucide-react";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { listModels, pickDefaultModel } from "@/lib/ai/catalog";
import type { PlanId } from "@/lib/config";
import { listProjects, serializeProject } from "@/lib/server/projects";
import { requireUser } from "@/lib/server/session";
import { NewProject } from "@/components/app/new-project";
import { ProjectCard } from "@/components/app/project-card";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const plan = user.plan as PlanId;
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, user.id));
  const [models, projects] = await Promise.all([listModels(plan), listProjects(user.id)]);
  const firstName = user.name.split(" ")[0];

  return (
    <main className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
      <section className="relative mx-auto max-w-3xl pt-16 pb-14 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-2xl rounded-full bg-[#ff7a1a]/15 blur-3xl" />
        <h1 className="text-3xl font-semibold tracking-tight sm:text-5xl">
          What will you <span className="font-serif font-normal italic text-gradient-ember">forge</span> today, {firstName}?
        </h1>
        <p className="mt-3 text-muted-foreground">Describe an app — the agent plans it, codes it and runs it in a live Next.js VM.</p>
        <div className="mt-8 text-left">
          <Suspense>
            <NewProject models={models} defaultModel={pickDefaultModel(prefs?.defaultModel, plan)} defaultTokenSaver={prefs?.tokenSaver ?? false} />
          </Suspense>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-semibold">Your projects</h2>
          <span className="text-sm text-muted-foreground">{projects.length} total</span>
        </div>
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
            <FolderOpenIcon className="size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No projects yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Your forged apps will show up here.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={serializeProject(p)} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
