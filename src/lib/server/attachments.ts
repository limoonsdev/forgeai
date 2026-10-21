import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { attachments } from "@/lib/db/schema";
import { newId } from "./ids";

export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
const DAILY_LIMIT = 150;

export class AttachmentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Detects the real image type from magic bytes. The client-declared type is never trusted. */
export function sniffImage(buf: Buffer): "image/png" | "image/jpeg" | "image/webp" | "image/gif" | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  return null;
}

export async function saveAttachment(userId: string, input: { name: string; data: Buffer; projectId?: string | null }) {
  if (input.data.length === 0) throw new AttachmentError("The file is empty.");
  if (input.data.length > ATTACHMENT_MAX_BYTES) throw new AttachmentError("Images must be 5 MB or smaller.", 413);
  const mime = sniffImage(input.data);
  if (!mime) throw new AttachmentError("Only PNG, JPEG, WebP and GIF images can be attached.", 415);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(attachments)
    .where(and(eq(attachments.userId, userId), gte(attachments.createdAt, new Date(Date.now() - 86_400_000))));
  if (count >= DAILY_LIMIT) throw new AttachmentError("Daily attachment limit reached. Try again tomorrow.", 429);
  const name = input.name.replace(/[^\w.\- ()]+/g, "_").slice(0, 120) || "image";
  const [row] = await db
    .insert(attachments)
    .values({ id: newId("att"), userId, projectId: input.projectId ?? null, name, mime, size: input.data.length, data: input.data })
    .returning({ id: attachments.id, name: attachments.name, mime: attachments.mime, size: attachments.size });
  return row;
}

export async function getAttachment(userId: string, id: string) {
  const [row] = await db.select().from(attachments).where(and(eq(attachments.id, id), eq(attachments.userId, userId)));
  return row ?? null;
}
