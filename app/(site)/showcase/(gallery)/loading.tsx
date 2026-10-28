import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import ShowcaseHeader from "./ShowcaseHeader";

// The real header (it is static) over card-shaped placeholders sized like
// ShowcaseGallery's cards, so the page does not jump when the first page of
// designs arrives. Lives in (gallery) so it never wraps /showcase/[id].

const BLOCK = "rounded-[5px] bg-paper-soft animate-pulse motion-reduce:animate-none";

export default function Loading() {
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main className="mx-auto w-full max-w-[1400px] px-[clamp(24px,5.5vw,84px)] pb-20 pt-12 sm:pt-16" aria-busy="true">
        <ShowcaseHeader primary={false} />
        <p role="status" className="sr-only">Loading designs…</p>
        <ul aria-hidden className="grid grid-cols-1 gap-[18px] pt-10 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="overflow-hidden rounded-md border border-line">
              <div className="aspect-[4/3] border-b border-line bg-paper-soft animate-pulse motion-reduce:animate-none" />
              <div className="p-5">
                <div className={`h-5 w-28 ${BLOCK}`} />
                <div className={`mt-3 h-[30px] w-3/4 ${BLOCK}`} />
                <div className={`mt-1 h-[21px] w-1/2 ${BLOCK}`} />
                <div className={`mt-5 h-5 w-2/5 ${BLOCK}`} />
              </div>
            </li>
          ))}
        </ul>
      </main>
      <Footer />
    </div>
  );
}
