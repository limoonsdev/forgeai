import { z } from "zod";
import { ConnectorError, deleteConnector, listUserConnectors, saveConnector } from "@/lib/connectors";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => json({ connectors: await listUserConnectors(auth.userId) }));

const Save = z.object({ connectorId: z.string().max(40), values: z.record(z.string(), z.string().max(4000)) });

/** Saves (encrypted) the credentials of one connector. Values are never sent back to the browser. */
export const PUT = withApi(
  async (req, { auth }) => {
    const body = Save.parse(await readJson(req, 32_000));
    try {
      await saveConnector(auth.userId, body.connectorId, body.values);
    } catch (err) {
      if (err instanceof ConnectorError) return errorResponse(400, "invalid_connector", err.message);
      throw err;
    }
    return json({ connectors: await listUserConnectors(auth.userId) });
  },
  { rateLimit: 30, bucket: "connectors" },
);

export const DELETE = withApi(async (req, { auth }) => {
  const id = new URL(req.url).searchParams.get("connectorId");
  if (!id) return errorResponse(400, "invalid_request", "connectorId is required");
  await deleteConnector(auth.userId, id);
  return json({ connectors: await listUserConnectors(auth.userId) });
});
