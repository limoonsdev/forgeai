import { getAttachment } from "@/lib/server/attachments";
import { errorResponse, withApi } from "@/lib/server/api";

type P = { id: string };

/** Owner-only image download (thumbnails in the chat). */
export const GET = withApi<P>(async (_req, { auth, params }) => {
  const row = await getAttachment(auth.userId, params.id);
  if (!row) return errorResponse(404, "not_found", "Attachment not found");
  return new Response(new Uint8Array(row.data), {
    headers: {
      "Content-Type": row.mime,
      "Cache-Control": "private, max-age=86400",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": `inline; filename="${row.name.replace(/"/g, "")}"`,
    },
  });
});
