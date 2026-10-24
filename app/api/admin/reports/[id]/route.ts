import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { db } from "@/lib/db";
import { validateReportDecision } from "@/lib/moderation";
import { afterResponse, notifyListingDecision } from "@/lib/notify";
import { parseJsonBody } from "@/lib/request";

/**
 * Resolve a listing report. `dismiss` closes just this report; `takedown`
 * rejects the listing (hiding it from every public surface), closes every
 * open report against it, and emails the lister the note as the reason.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  const decision = await parseJsonBody(request, validateReportDecision);
  if (decision instanceof Response) return decision;

  const { data: report, error: lookupError } = await db
    .from("listing_reports")
    .select("id, property_id, status")
    .eq("id", id)
    .maybeSingle<{ id: number; property_id: string; status: string }>();
  if (lookupError) {
    console.error(`POST /api/admin/reports/${id} lookup failed:`, lookupError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!report) return Response.json({ error: "not found" }, { status: 404 });

  const resolved = { resolved_at: new Date().toISOString(), resolved_by: adminId };

  if (decision.action === "dismiss") {
    const { error } = await db
      .from("listing_reports")
      .update({ ...resolved, status: "dismissed" })
      .eq("id", id);
    if (error) {
      console.error(`POST /api/admin/reports/${id} dismiss failed:`, error.message);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
    await logAdminAction({
      adminId,
      action: "dismiss",
      targetType: "report",
      targetId: String(report.id),
      note: decision.note,
    });
    return Response.json({ id: report.id, status: "dismissed" });
  }

  // Take down: listing first, so a failure leaves the report open to retry.
  const { data: listing, error: takedownError } = await db
    .from("properties")
    .update({
      status: "rejected",
      reviewed_at: resolved.resolved_at,
      reviewed_by: adminId,
      review_note: decision.note,
    })
    .eq("id", report.property_id)
    .select("building_name, address, user_id")
    .maybeSingle<{ building_name: string | null; address: string; user_id: string | null }>();
  if (takedownError) {
    console.error(`POST /api/admin/reports/${id} takedown failed:`, takedownError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  const { error } = await db
    .from("listing_reports")
    .update({ ...resolved, status: "actioned" })
    .eq("property_id", report.property_id)
    .eq("status", "open");
  if (error) {
    console.error(`POST /api/admin/reports/${id} close failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  await logAdminAction({
    adminId,
    action: "takedown",
    targetType: "listing",
    targetId: report.property_id,
    note: decision.note,
    details: { report: report.id },
  });
  if (listing) {
    afterResponse(() =>
      notifyListingDecision({
        listerId: listing.user_id,
        listingName: listing.building_name || listing.address,
        approved: false,
        note: decision.note,
      }),
    );
  }
  return Response.json({ id: report.id, status: "actioned" });
}
