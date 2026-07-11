import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { FEES } from "@/lib/fees";

/**
 * GET /api/purchases?purpose=builder_unlock[&ref=<id>] → { unlocked } for the
 * current user; ref narrows to a specific thing (e.g. one property's contact).
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "signed out" }, { status: 401 });

  const params = new URL(request.url).searchParams;
  const purpose = params.get("purpose") ?? "";
  const ref = params.get("ref");
  if (!(purpose in FEES)) {
    return Response.json({ error: "unknown purpose" }, { status: 400 });
  }

  let q = db
    .from("purchases")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", purpose);
  if (ref) q = q.eq("ref", ref);
  const { count, error } = await q;
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ unlocked: (count ?? 0) > 0 });
}
