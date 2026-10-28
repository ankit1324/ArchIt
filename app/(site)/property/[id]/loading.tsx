import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

// Skeleton in page.tsx's exact frame (same container, header grid, CTA row,
// photo plate and details grid) so content swaps in without a layout jump.
// layout.tsx has already confirmed the listing exists by the time this shows,
// which keeps unknown ids a real 404.

const BLOCK = "rounded-[5px] bg-paper-soft animate-pulse motion-reduce:animate-none";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8 sm:px-8 sm:pt-10" aria-busy="true">
        <p role="status" className="sr-only">Loading listing…</p>
        <div className={`h-4 w-40 ${BLOCK}`} />
        <div className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-10">
          <div>
            <div className={`h-4 w-24 ${BLOCK}`} />
            <div className={`mt-3 h-[37px] w-4/5 sm:h-[53px] ${BLOCK}`} />
            <div className={`mt-3 h-6 w-3/5 ${BLOCK}`} />
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            <div className={`h-8 w-36 ${BLOCK}`} />
            <div className={`h-6 w-20 rounded-full ${BLOCK}`} />
          </div>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-line pt-6">
          <div className={`h-11 w-full sm:mr-2 sm:w-48 ${BLOCK}`} />
          <div className={`h-11 w-32 ${BLOCK}`} />
          <div className={`h-11 w-28 ${BLOCK}`} />
        </div>
        <div className={`mt-8 aspect-[16/7] border border-line ${BLOCK}`} />
        <div className="mt-12">
          <div className={`h-8 w-28 ${BLOCK}`} />
          <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="border-t border-line pt-3">
                <div className={`h-4 w-16 ${BLOCK}`} />
                <div className={`mt-1 h-6 w-24 ${BLOCK}`} />
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
