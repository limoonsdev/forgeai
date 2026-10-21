import { buildDataExport } from "@/lib/server/account";
import { withApi } from "@/lib/server/api";

/** Download everything Forged stores about you (GDPR access and portability). */
export const GET = withApi(
  async (_req, { auth }) => {
    const data = await buildDataExport(auth.userId);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(data as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="forged-data-${date}.zip"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
  { rateLimit: 3, bucket: "export" },
);
