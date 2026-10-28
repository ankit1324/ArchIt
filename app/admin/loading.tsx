import { eyebrow } from "./ui";

// Shown inside the admin layout (header and tabs stay put) while a page's
// queries run. Hairline placeholders in the shape of a page header and a
// table, rather than a spinner, so the jump to real content is small.
// The admin gate in layout.tsx runs outside this Suspense boundary, so
// outsiders still get a real 404; only an admin opening a missing listing or
// user gets the streamed not-found page with a 200, which is fine for noindex.
export default function Loading() {
  return (
    <div role="status" aria-live="polite">
      <p className={`flex items-center gap-2.5 ${eyebrow}`}>
        <span className="size-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
        Loading
      </p>
      <div aria-hidden="true" className="animate-pulse motion-reduce:animate-none">
        <div className="mt-4 h-9 w-56 rounded-[5px] bg-paper-soft" />
        <div className="mt-10 overflow-hidden rounded-md border border-line">
          <div className="h-10 border-b border-line bg-paper-soft" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="flex gap-6 border-t border-line px-3 py-3 first:border-t-0">
              <div className="h-4 w-28 rounded-[3px] bg-paper-soft" />
              <div className="h-4 flex-1 rounded-[3px] bg-paper-soft" />
              <div className="h-4 w-20 rounded-[3px] bg-paper-soft" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
