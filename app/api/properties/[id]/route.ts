import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing } from "@/lib/db";
import type { Listing } from "@/lib/types";

/**
 * Only the lister may edit or delete. Legacy rows (no user_id) predate
 * ownership and stay open. Returns null when allowed, or a Response error.
 */
async function ownershipError(id: string): Promise<Response | null> {
  const { userId } = await auth();
  const { data, error } = await db
    .from("properties")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  if (data.user_id && data.user_id !== userId) {
    return Response.json(
      { error: "only the lister can change this property" },
      { status: 403 },
    );
  }
  return null;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const denied = await ownershipError(id);
  if (denied) return denied;

  const l = (await request.json()) as Omit<Listing, "id">;
  const { data, error } = await db
    .from("properties")
    .update(listingToRow(l))
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(rowToListing(data));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const denied = await ownershipError(id);
  if (denied) return denied;

  const { count, error } = await db
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!count) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
