import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicListing } from "@/lib/public-listings";

// Keeps a missing listing a real 404. loading.tsx wraps page.tsx in Suspense,
// and once its fallback streams the status is fixed at 200, so a notFound()
// in the page alone would answer a soft 404. A layout sits outside its own
// segment's loading boundary, so checking here settles the status before any
// byte streams. getPublicListing is React cache()d: the page's call reuses
// this lookup instead of querying again.
export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  // per request, like the page (see its connection() note)
  await connection();
  const { id } = await params;
  if (!(await getPublicListing(id))) notFound();
  return children;
}
