import { db, designToRow, rowToDesign } from "@/lib/db";
import type { Design } from "@/lib/types";

export async function GET() {
  const { data, error } = await db
    .from("designs")
    .select("*")
    .order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data.map(rowToDesign));
}

export async function POST(request: Request) {
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
    .insert(designToRow({ ...d, name: d.name || "My home" }))
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(rowToDesign(data), { status: 201 });
}
