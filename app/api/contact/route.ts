import { auth } from "@clerk/nextjs/server";
import { MAX_CONTACT_BYTES, validateContact } from "@/lib/contact";
import { db } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";

/** PostgREST "table not in schema cache" / Postgres "relation does not exist". */
const MISSING_TABLE = new Set(["PGRST205", "42P01"]);

/**
 * Public contact form (/contact). Anyone may write; rate-limited per IP.
 * Messages land in contact_messages for the /admin/inbox queue — no email
 * provider involved. A signed-in sender's Clerk id is attached so an admin
 * can look them up.
 */
export async function POST(request: Request) {
  // Per IP, even when signed in: one person shouldn't flood the inbox by
  // switching accounts, and anonymous senders have nothing else to key on.
  if (!(await checkRateLimit(ipKey(request, "contact"), 5, 60 * 60_000))) {
    return rateLimitedResponse();
  }
  const input = await parseJsonBody(request, validateContact, { maxBytes: MAX_CONTACT_BYTES });
  if (input instanceof Response) return input;
  // Honeypot tripped: look successful, store nothing.
  if (input.spam) return Response.json({ ok: true }, { status: 201 });

  let userId: string | null = null;
  try {
    ({ userId } = await auth());
  } catch {
    // No session context (e.g. Clerk unavailable): still accept the message.
  }

  const { error } = await db.from("contact_messages").insert({
    name: input.name,
    email: input.email,
    topic: input.topic,
    message: input.message,
    user_id: userId,
  });
  if (error && MISSING_TABLE.has(error.code)) {
    console.error("POST /api/contact: contact_messages table missing — apply the migration");
    return Response.json(
      { error: "The contact form isn't available right now. Please try again later." },
      { status: 503 },
    );
  }
  if (error) {
    console.error("POST /api/contact failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
