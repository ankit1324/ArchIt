import { auth } from "@clerk/nextjs/server";
import { db, designToRow, rowToDesign } from "@/lib/db";
import { builderUnlockError } from "@/lib/entitlements";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { safeImageUrl } from "@/lib/url";
import { MAX_DESIGN_BYTES, validateDesign } from "@/lib/validators";

// Designs are private: every query is scoped to the signed-in user, and the
// builder is a paid product (₹2000 builder_unlock) gated by the ledger check.

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const locked = await builderUnlockError(userId);
  if (locked) return locked;
  const { data, error } = await db
    .from("designs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");
  if (error) {
    console.error("GET /api/designs failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json(data.map(rowToDesign));
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // shared bucket across POST/PUT/DELETE: each write uploads up to ~1 MB
  if (!(await checkRateLimit(ipKey(request, "designs-write", userId), 30, 60_000))) {
    return rateLimitedResponse();
  }
  const locked = await builderUnlockError(userId);
  if (locked) return locked;
  // designs carry the full block list; allow the 1 MB design cap plus envelope
  const d = await parseJsonBody(request, (v) => validateDesign(v, safeImageUrl), {
    maxBytes: MAX_DESIGN_BYTES + 64 * 1024,
  });
  if (d instanceof Response) return d;
  const { data, error } = await db
    .from("designs")
    .insert({ ...designToRow(d), user_id: userId })
    .select()
    .single();
  if (error) {
    console.error("POST /api/designs failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json(rowToDesign(data), { status: 201 });
}
