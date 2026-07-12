import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing } from "@/lib/db";
import type { Listing } from "@/lib/types";

export async function GET() {
  const { data, error } = await db
    .from("properties")
    .select("*")
    .order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data.map(rowToListing));
}

export async function POST(request: Request) {
  const l = (await request.json()) as Omit<Listing, "id">;
  if (!l.address || !l.price || !l.coords) {
    return Response.json({ error: "address, price, coords required" }, { status: 400 });
  }
  // lister recorded from the session, never from the client body
  const { userId } = await auth();
  const { data, error } = await db
    .from("properties")
    .insert({ ...listingToRow(l), user_id: userId })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(rowToListing(data), { status: 201 });
}
