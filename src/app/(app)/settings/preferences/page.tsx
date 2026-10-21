import type { Metadata } from "next";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { listModels, pickDefaultModel } from "@/lib/ai/catalog";
import type { PlanId } from "@/lib/config";
import { requireUser } from "@/lib/server/session";
import { PreferencesForm } from "@/components/settings/preferences-form";

export const metadata: Metadata = { title: "Preferences" };

export default async function PreferencesPage() {
  const user = await requireUser();
  await db.insert(preferences).values({ userId: user.id }).onConflictDoNothing();
  const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, user.id));
  const models = await listModels(user.plan as PlanId);
  return (
    <PreferencesForm
      models={models}
      initial={{
        defaultModel: pickDefaultModel(prefs.defaultModel, user.plan as PlanId),
        tokenSaver: prefs.tokenSaver,
        aiLanguage: prefs.aiLanguage,
        stylePreset: prefs.stylePreset,
        customInstructions: prefs.customInstructions,
        autoFixErrors: prefs.autoFixErrors,
        askClarifyingQuestions: prefs.askClarifyingQuestions,
        emailNotifications: prefs.emailNotifications,
      }}
    />
  );
}
