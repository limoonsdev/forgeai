import type { Metadata } from "next";
import { listUserConnectors } from "@/lib/connectors";
import { requireUser } from "@/lib/server/session";
import { ConnectorsView } from "@/components/settings/connectors-view";

export const metadata: Metadata = { title: "Connectors" };

export default async function ConnectorsPage() {
  const user = await requireUser();
  const rows = await listUserConnectors(user.id);
  return <ConnectorsView initial={rows.map((r) => ({ connectorId: r.connectorId, hint: r.hint }))} />;
}
