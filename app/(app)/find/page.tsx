import { auth } from "@clerk/nextjs/server";
import { listProperties } from "@/lib/properties";
import { isDesignId } from "@/lib/showcase";
import { getPublishedDesign, listPublishedDesigns } from "@/lib/showcase-db";
import FindClient from "./FindClient";

/** published designs pinned on the map: located only, newest first */
const MAP_DESIGN_LIMIT = 200;

// Server-rendered first page of listings: the client no longer waits for
// hydrate → fetch before it can show cards, and the map chunk, style and
// tiles start loading with the data already in hand. Published designs with a
// map pin ship with it too (the "Designs" layer).
export default async function FindPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string | string[]; design?: string | string[] }>;
}) {
  const { userId } = await auth();
  // deep links from a public /property/:id page or a /showcase/:id viewer
  const { property, design } = await searchParams;
  const designId = isDesignId(design) ? design : null;
  const [initialPage, mapDesigns, linkedDesign] = await Promise.all([
    listProperties({ userId }).catch((error: Error) => {
      // the client retries from the browser and shows its error state
      console.error("/find initial listings failed:", error.message);
      return null;
    }),
    listPublishedDesigns({ viewerId: userId, limit: MAP_DESIGN_LIMIT, located: true }).catch(
      (error: Error) => {
        // the client fetches them itself
        console.error("/find initial designs failed:", error.message);
        return null;
      },
    ),
    // a deep-linked design may be older than the newest MAP_DESIGN_LIMIT: read
    // it on its own so ?design= never silently misses (null when private)
    designId
      ? getPublishedDesign(designId, userId).catch((error: Error) => {
          console.error("/find linked design failed:", error.message);
          return null;
        })
      : Promise.resolve(null),
  ]);
  const initialDesigns =
    mapDesigns && linkedDesign?.plotCenter && !mapDesigns.some((d) => d.id === linkedDesign.id)
      ? [...mapDesigns, linkedDesign]
      : mapDesigns;
  return (
    <FindClient
      initialPage={initialPage}
      initialSelectedId={typeof property === "string" ? property : null}
      initialDesigns={initialDesigns}
      initialDesignId={designId}
    />
  );
}
