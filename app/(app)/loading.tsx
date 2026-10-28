// Minimal loading state for transitions into the app group. Kept out of the
// root segment on purpose: a root Suspense boundary would make every page
// stream, and a streamed /property/:id that calls notFound() answers 200.
// /find and /designer are client components with their own fetch-driven
// spinners already — this only covers the brief gap before those mount.
export default function Loading() {
  return (
    // role=status announces the wait to screen readers; motion-reduce stops
    // the spin for users who asked the OS for less motion.
    <div
      role="status"
      className="flex min-h-full flex-col items-center justify-center gap-4 bg-paper text-ink-soft"
    >
      <div
        aria-hidden="true"
        className="size-7 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
      />
      <p className="text-[11px] font-bold uppercase tracking-[0.14em]">Loading</p>
    </div>
  );
}
