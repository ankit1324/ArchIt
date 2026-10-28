import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ShowcaseGallery, { SHOWCASE_PAGE_SIZE } from "@/components/ShowcaseGallery";
import { listPublishedDesigns } from "@/lib/showcase-db";
import type { PublishedDesign } from "@/lib/types";
import EmptyShowcase from "./EmptyShowcase";
import ShowcaseHeader, { SECONDARY } from "./ShowcaseHeader";

const TITLE = "Showcase — homes designed in 3D";
const DESCRIPTION =
  "Homes designed by the ArchIt community. Open any design to walk around it in 3D, right in the browser.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/showcase" },
  openGraph: {
    type: "website",
    siteName: "ArchIt",
    locale: "en_IN",
    url: "/showcase",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

// Public gallery of published designs (proxy.ts leaves /showcase open), newest
// first. Rendered per request — auth() reads the request, and proxy.ts gives
// /showcase the nonce CSP since it shows user content — so a newly published
// or unpublished design shows up immediately. It sits in the (gallery) group
// so its loading.tsx wraps only this page: a boundary at /showcase would also
// wrap /showcase/[id] and turn an unknown design's 404 into a streamed 200.
export default async function ShowcasePage() {
  const { userId } = await auth();
  let designs: PublishedDesign[] | null = null;
  try {
    designs = await listPublishedDesigns({ viewerId: userId, limit: SHOWCASE_PAGE_SIZE });
  } catch (e) {
    console.error("/showcase failed:", e instanceof Error ? e.message : e);
  }

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] px-[clamp(24px,5.5vw,84px)] pb-20 pt-12 sm:pt-16">
        <ShowcaseHeader primary={!!designs?.length} />

        {designs === null ? (
          <div
            className="mx-auto mt-12 flex max-w-md flex-col items-center gap-5 rounded-md border border-line bg-paper-soft px-6 py-10 text-center"
            role="alert"
          >
            <p className="font-display text-[22px] font-normal">Couldn&apos;t load the showcase.</p>
            <Link href="/showcase" prefetch={false} className={SECONDARY}>
              Try again
            </Link>
          </div>
        ) : designs.length === 0 ? (
          <EmptyShowcase />
        ) : (
          <div className="pt-10">
            <ShowcaseGallery initial={designs} initialHasMore={designs.length === SHOWCASE_PAGE_SIZE} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
