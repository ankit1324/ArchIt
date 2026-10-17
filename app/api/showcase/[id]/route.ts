import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { DesignRow } from "@/lib/db";
import { SHOWCASE_COLUMNS, toPublishedDesign } from "@/lib/showcase";

// One published design including its v3 JSON, for the read-only viewer.
// Private designs are a 404 for everyone, the owner included (they use /designer).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  const { id } = await params;
  const { data, error } = await db
    .from("designs")
    .select(`${SHOWCASE_COLUMNS}, design`)
    .eq("id", id)
    .not("published_at", "is", null)
    .maybeSingle<DesignRow>();
  if (error) {
    console.error(`GET /api/showcase/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(toPublishedDesign(data, userId ?? null, { includeDesign: true }));
}
