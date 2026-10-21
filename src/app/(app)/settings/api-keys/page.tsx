import type { Metadata } from "next";
import { listApiKeys } from "@/lib/server/api-keys";
import { requireUser } from "@/lib/server/session";
import { absoluteUrl } from "@/lib/utils";
import { ApiKeysView } from "@/components/settings/api-keys-view";

export const metadata: Metadata = { title: "API keys" };

export default async function ApiKeysPage() {
  const user = await requireUser();
  const keys = await listApiKeys(user.id);
  return (
    <ApiKeysView
      baseUrl={absoluteUrl()}
      initial={keys.map((k) => ({ ...k, lastUsedAt: k.lastUsedAt?.toISOString() ?? null, createdAt: k.createdAt.toISOString() }))}
    />
  );
}
