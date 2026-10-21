import "server-only";
import nodemailer from "nodemailer";

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
function smtp() {
  if (!process.env.SMTP_HOST) return null;
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: (process.env.SMTP_SECURE ?? "true") !== "false",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
  });
  return transport;
}

export function emailConfigured() {
  return Boolean(process.env.SMTP_HOST || process.env.RESEND_API_KEY);
}

/**
 * Transactional email: SMTP (e.g. Hostinger mail) or Resend.
 * Without configuration, emails are printed to the console in development only
 * (never in production: they contain one-time links).
 */
export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  const from = process.env.EMAIL_FROM || "Forged <noreply@forged.dev>";
  const transporter = smtp();
  if (transporter) {
    await transporter.sendMail({ from, to, subject, html });
    return;
  }
  if (process.env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error("[email] Resend error", res.status);
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    console.info(`[email:dev] to=${to} subject="${subject}"\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`);
  } else {
    console.warn("[email] no email provider configured — message not sent");
  }
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function emailLayout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#0f0d0c;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#f4efe9">
  <div style="max-width:520px;margin:0 auto;padding:40px 24px">
    <div style="font-weight:800;font-size:18px;letter-spacing:-0.02em;margin-bottom:28px">Forged<span style="color:#9b928a">.dev</span></div>
    <h1 style="font-size:22px;margin:0 0 12px;letter-spacing:-0.02em">${esc(title)}</h1>
    <div style="font-size:15px;line-height:1.6;color:#d8d0c8">${body}</div>
    ${
      cta
        ? `<a href="${esc(cta.url)}" style="display:inline-block;margin-top:24px;padding:12px 22px;border-radius:10px;background:#e8501a;color:#fff;text-decoration:none;font-weight:600">${esc(cta.label)}</a>`
        : ""
    }
    <p style="margin-top:40px;font-size:12px;color:#7d746c">You received this email because you have an account on Forged.dev.</p>
  </div></body></html>`;
}
