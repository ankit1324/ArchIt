import { db } from "@/lib/db";

export async function GET() {
  const { data, error } = await db.from("properties").select("id").limit(1);
  if (error) {
    return Response.json({ error: error.message }, { status: 503 });
  }
  return Response.json({ ok: true, count: data?.length ?? 0, ts: Date.now() });
}
