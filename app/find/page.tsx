import { auth } from "@clerk/nextjs/server";
import { listProperties } from "@/lib/properties";
import FindClient from "./FindClient";

// Server-rendered first page of listings: the client no longer waits for
// hydrate → fetch before it can show cards, and the map chunk, style and
// tiles start loading with the data already in hand.
export default async function FindPage() {
  const { userId } = await auth();
  const initialPage = await listProperties({ userId }).catch((error: Error) => {
    // the client retries from the browser and shows its error state
    console.error("/find initial listings failed:", error.message);
    return null;
  });
  return <FindClient initialPage={initialPage} />;
}
