import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/project", "/settings"];
const AUTH_PAGES = ["/login", "/signup"];
const REF_COOKIE = "forged_ref";
// Mirrors SESSION_COOKIE in lib/auth.ts (the proxy can't import server-only modules).
const SESSION_COOKIES = ["__Host-forged.session_token", "forged.session_token"];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  // Only a hint for redirects: every page and route still validates the session on the server.
  const hasSession = SESSION_COOKIES.some((n) => request.cookies.has(n));

  let response: NextResponse;
  if (PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`)) && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname + (request.nextUrl.search || ""));
    response = NextResponse.redirect(url);
  } else if (AUTH_PAGES.includes(pathname) && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = searchParams.get("next")?.startsWith("/") ? searchParams.get("next")! : "/dashboard";
    url.search = "";
    response = NextResponse.redirect(url);
  } else {
    response = NextResponse.next();
  }

  // Referral links: forged.dev/?ref=CODE (or /r/CODE) — remember the code for 30 days.
  const ref = searchParams.get("ref");
  if (ref && /^[A-Za-z0-9]{4,16}$/.test(ref)) {
    response.cookies.set(REF_COOKIE, ref.toUpperCase(), {
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
