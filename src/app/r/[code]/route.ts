import { NextResponse } from "next/server";
import { REF_COOKIE } from "@/lib/config";

/** Short referral links: forged.dev/r/CODE → sign-up page with the code remembered. */
export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }) {
  const { code } = await ctx.params;
  const url = new URL("/signup", req.url);
  const res = NextResponse.redirect(url);
  if (/^[A-Za-z0-9]{4,16}$/.test(code)) {
    res.cookies.set(REF_COOKIE, code.toUpperCase(), { maxAge: 60 * 60 * 24 * 30, path: "/", sameSite: "lax" });
  }
  return res;
}
