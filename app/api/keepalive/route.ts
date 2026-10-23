import { db } from "@/lib/db";
import { isCronRequest } from "@/lib/cron-auth";

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await db.from("properties").select("id").limit(1);
  if (error) {
    console.error("Keepalive ping failed:", error.message);
    return Response.json({ error: "db unreachable" }, { status: 503 });
  }
  return Response.json({ ok: true, count: data?.length ?? 0, ts: Date.now() });
}
