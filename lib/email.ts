import "server-only";
import type { EmailMessage } from "./email-templates";

/**
 * Transactional email via Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
 * Env-gated like lib/alert.ts: with RESEND_API_KEY or EMAIL_FROM unset, sends
 * are logged and skipped so local dev and CI never mail anyone.
 *
 * Plain fetch rather than the SDK — one endpoint, no extra dependency. Never
 * throws: a failed email must not fail a payment or a moderation action.
 */
export async function sendEmail(to: string, message: EmailMessage): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) {
    console.info(`[email skipped: RESEND_API_KEY/EMAIL_FROM unset] "${message.subject}"`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [to],
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.error(`email send failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("email send failed:", e instanceof Error ? e.message : e);
    return false;
  }
}
