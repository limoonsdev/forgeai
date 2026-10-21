import "server-only";

/**
 * Minimal transactional email sender.
 * Uses Resend's REST API when RESEND_API_KEY is set, otherwise logs to the console (dev).
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Forged.dev <noreply@forged.dev>";
  if (!key) {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("[email] send failed", res.status, await res.text().catch(() => ""));
  }
}

export function emailLayout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#120e0c;font-family:Inter,Arial,sans-serif;color:#f4efe9">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:700;font-size:18px;margin-bottom:24px">🔥 Forged<span style="color:#a39a91">.dev</span></div>
    <h1 style="font-size:22px;margin:0 0 12px">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#d6cec6">${body}</div>
    ${
      cta
        ? `<a href="${cta.url}" style="display:inline-block;margin-top:24px;padding:12px 22px;border-radius:10px;background:linear-gradient(135deg,#ff4d26,#ff7a1a,#ffb347);color:#fff;text-decoration:none;font-weight:600">${cta.label}</a>`
        : ""
    }
    <p style="margin-top:40px;font-size:12px;color:#7d746c">You received this email because you have an account on Forged.dev.</p>
  </div></body></html>`;
}
