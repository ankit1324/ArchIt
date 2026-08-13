import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { isFeePurpose } from "@/lib/payment-validation";
import { retryTransientDb } from "@/lib/retry";

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
  // isFeePurpose, not `purpose in FEES`: `in` also matches inherited keys, so
  // ?purpose=toString would sail past the guard.
  if (!isFeePurpose(purpose)) {
    return Response.json({ error: "unknown purpose" }, { status: 400 });
  }

  const result = await retryTransientDb(async () => {
    let query = db
      .from("purchases")
      .select("id")
      .eq("user_id", userId)
      .eq("purpose", purpose)
      .limit(1);
    if (ref) query = query.eq("ref", ref);
    return query.maybeSingle();
  });
  if (result.error) {
    const unavailable = result.error.message.includes("fetch failed");
    console.error("Purchases lookup failed:", result.error.message);
    return Response.json(
      { error: unavailable ? "purchase service unavailable" : "internal error" },
      { status: unavailable ? 503 : 500 },
    );
  }
  return Response.json({ unlocked: result.data !== null });
}
