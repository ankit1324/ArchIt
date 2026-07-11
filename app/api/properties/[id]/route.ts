import { db, listingToRow, rowToListing } from "@/lib/db";
import type { Listing } from "@/lib/types";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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
  const { count, error } = await db
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!count) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
