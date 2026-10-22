import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

/** Constant-time bearer check; a length mismatch is simply a mismatch. */
function bearerMatches(header: string | null, secret: string): boolean {
  const presented = Buffer.from(header ?? "", "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !bearerMatches(request.headers.get("authorization"), secret)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await db.from("properties").select("id").limit(1);
  if (error) {
    console.error("Keepalive ping failed:", error.message);
    return Response.json({ error: "db unreachable" }, { status: 503 });
  }
  return Response.json({ ok: true, count: data?.length ?? 0, ts: Date.now() });
}
