import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ShowcaseGallery, { SHOWCASE_PAGE_SIZE } from "@/components/ShowcaseGallery";
import { listPublishedDesigns } from "@/lib/showcase-db";
import type { PublishedDesign } from "@/lib/types";

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
// or unpublished design shows up immediately.
export default async function ShowcasePage() {
  const { userId } = await auth();
  let designs: PublishedDesign[] | null = null;
  try {
    designs = await listPublishedDesigns({ viewerId: userId, limit: SHOWCASE_PAGE_SIZE });
  } catch (e) {
    console.error("/showcase failed:", e instanceof Error ? e.message : e);
  }

  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[28px] font-extrabold leading-tight sm:text-[34px]">Showcase</h1>
            <p className="mt-1 max-w-xl text-[14px] font-medium text-plum-soft">
              Homes designed by the ArchIt community. Open one to walk around it in 3D.
            </p>
          </div>
          <Link
            href="/designer"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-full bg-plum px-5 py-2 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
          >
            Design your own
          </Link>
        </div>

        {designs === null ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
            <p className="font-bold">Couldn&apos;t load the showcase.</p>
            <Link
              href="/showcase"
              prefetch={false}
              className="rounded-full border border-plum/20 px-4 py-2 text-sm font-bold hover:bg-plum/5"
            >
              Try again
            </Link>
          </div>
        ) : designs.length === 0 ? (
          <div className="glass mx-auto mt-10 max-w-sm rounded-3xl p-8 text-center">
            <h2 className="text-lg font-extrabold">Nothing published yet</h2>
            <p className="mt-2 text-[13.5px] font-medium text-plum-soft">
              Design a home and publish it to be the first one here.
            </p>
            <Link
              href="/designer"
              prefetch={false}
              className="mt-6 inline-block w-full rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
            >
              Open the designer
            </Link>
          </div>
        ) : (
          <ShowcaseGallery initial={designs} initialHasMore={designs.length === SHOWCASE_PAGE_SIZE} />
        )}
      </main>
      <Footer />
    </div>
  );
}
