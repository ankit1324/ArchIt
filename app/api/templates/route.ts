import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { TEMPLATE_CATALOG } from "@/lib/template-catalog";

/**
 * GET /api/templates → the full catalog plus which paid templates this user owns.
 *
 * Metadata only — name/category/description are public so the picker can render
 * locked cards. Geometry never appears here; it comes from /api/templates/[key]
 * and only after the ledger check there.
 */
export async function GET() {
  const { userId } = await auth();

  let owned: string[] = [];
  if (userId) {
    const { data, error } = await db
      .from("purchases")
      .select("ref")
      .eq("user_id", userId)
      .eq("purpose", "template_unlock");
    if (error) {
      console.error("template purchases lookup failed:", error.message);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
    owned = (data ?? []).map((r) => r.ref).filter((ref): ref is string => !!ref);
  }

  return Response.json({
    templates: TEMPLATE_CATALOG,
    owned,
    signedIn: Boolean(userId),
  });
}
