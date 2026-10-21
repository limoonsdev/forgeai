import "server-only";
import { notFound } from "next/navigation";
import { getCurrentUser } from "./session";

/** Comma-separated ADMIN_EMAILS. Only verified accounts with one of these addresses are admins. */
export function isAdminEmail(email: string | null | undefined) {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && list.includes(email.toLowerCase()));
}

/** For pages: unknown to non-admins (404, so the page's existence isn't revealed). */
export async function requireAdminPage() {
  const u = await getCurrentUser();
  if (!u || !u.emailVerified || !isAdminEmail(u.email)) notFound();
  return u;
}
