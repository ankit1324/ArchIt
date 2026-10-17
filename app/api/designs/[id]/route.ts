import { auth } from "@clerk/nextjs/server";
import { db, designUpdateRow, rowToDesign } from "@/lib/db";
import { builderUnlockError } from "@/lib/entitlements";
import type { Design } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";

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
  // snapshots are shown to other users once published: same allowlist as
  // photos. A non-allowlisted one is dropped rather than rejected: when the
  // thumbnail upload fails the designer re-sends the stored snapshot, and a
  // legacy row's URL must not block every later save of that design.
  const snapshot = safeImageUrl(d.snapshot) ?? undefined;
  // designUpdateRow drops plot_lng/plot_lat: the picked location moves only via
  // the publish route (the designer sends [0, 0] for standalone designs).
  // Editing a published design keeps it published.
  const { data, error } = await db
    .from("designs")
    .update(designUpdateRow({ ...d, snapshot }))
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
