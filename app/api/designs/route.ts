import { auth } from "@clerk/nextjs/server";
import { db, designToRow, rowToDesign } from "@/lib/db";
import type { Design } from "@/lib/types";

// Designs are private: every query is scoped to the signed-in user.

export async function GET() {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
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
    .insert({ ...designToRow({ ...d, name: d.name || "My home" }), user_id: userId })
    .select()
    .single();
  if (error) {
    console.error("POST /api/designs failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json(rowToDesign(data), { status: 201 });
}
