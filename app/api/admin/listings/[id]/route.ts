import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { validateListingDecision } from "@/lib/moderation";
import { afterResponse, notifyListingDecision } from "@/lib/notify";
import { parseJsonBody } from "@/lib/request";

/**
 * Approve or reject a listing from the /admin queue. Either decision can be
 * reversed later (approve a rejected listing, reject a live one). The lister
 * is emailed after the response.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  const decision = await parseJsonBody(request, validateListingDecision);
  if (decision instanceof Response) return decision;

  const approved = decision.action === "approve";
  const { data, error } = await db
    .from("properties")
    .update({
      status: approved ? "live" : "rejected",
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      review_note: decision.note,
    })
    .eq("id", id)
    .select("id, building_name, address, user_id, status")
    .maybeSingle<{
      id: string;
      building_name: string | null;
      address: string;
      user_id: string | null;
      status: string;
    }>();
  if (error) {
    console.error(`POST /api/admin/listings/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  afterResponse(() =>
    notifyListingDecision({
      listerId: data.user_id,
      listingName: data.building_name || data.address,
      approved,
      note: decision.note,
    }),
  );
  return Response.json({ id: data.id, status: data.status });
}
