import { AttachmentError, ATTACHMENT_MAX_BYTES, saveAttachment } from "@/lib/server/attachments";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

/** Upload one image (multipart field "file"). Returns its id to send with the next prompt. */
export const POST = withApi(
  async (req, { auth }) => {
    const declared = Number(req.headers.get("content-length") || 0);
    if (declared > ATTACHMENT_MAX_BYTES + 64_000) return errorResponse(413, "too_large", "Images must be 5 MB or smaller.");
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return errorResponse(400, "invalid_request", "No file received.");
    const projectId = typeof form?.get("projectId") === "string" ? String(form?.get("projectId")) : null;
    if (projectId && !(await getOwnedProject(auth.userId, projectId))) return errorResponse(404, "not_found", "Project not found");
    try {
      const row = await saveAttachment(auth.userId, { name: file.name, data: Buffer.from(await file.arrayBuffer()), projectId });
      return json(row, { status: 201 });
    } catch (err) {
      if (err instanceof AttachmentError) return errorResponse(err.status, "invalid_attachment", err.message);
      throw err;
    }
  },
  { rateLimit: 40, bucket: "attachments" },
);
