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
      aria-label="Loading"
      className="flex h-full min-h-screen items-center justify-center bg-cream"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-plum/20 border-t-plum motion-reduce:animate-none" />
    </div>
  );
}
