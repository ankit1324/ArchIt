import { auth } from "@clerk/nextjs/server";
import { db, designToRow, rowToDesign } from "@/lib/db";
import { builderUnlockError } from "@/lib/entitlements";
import type { Design } from "@/lib/types";

// Updates/deletes are owner-only — the user_id filter makes other users' ids a 404.
// [PAYWALL DISABLED — free for now] These routes also used to require the paid
// builder_unlock; the ledger check is commented out so designs are free.
// Restore the calls to re-enable the paywall.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // [PAYWALL DISABLED — free for now]
  // const locked = await builderUnlockError(userId);
  // if (locked) return locked;
  const { id } = await params;
  const d = (await request.json()) as Omit<Design, "id">;
  if (
    !d.plotCenter ||
    d.design?.v !== 3 ||
    !(d.design.state.floors?.some((f) => f.blocks.length) ??
      d.design.state.blocks?.length)
  ) {
    return Response.json(
      { error: "plotCenter and a non-empty v3 design required" },
      { status: 400 },
    );
  }
  const { data, error } = await db
    .from("designs")
    .update(designToRow(d))
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) {
    console.error(`PUT /api/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(rowToDesign(data));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // [PAYWALL DISABLED — free for now]
  // const locked = await builderUnlockError(userId);
  // if (locked) return locked;
  const { id } = await params;
  const { count, error } = await db
    .from("designs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    console.error(`DELETE /api/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!count) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
