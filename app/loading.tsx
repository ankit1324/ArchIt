// Minimal, framework-level loading state for the root segment transition.
// /find and /designer are client components with their own fetch-driven
// spinners already — this only covers the brief gap before those mount.
export default function Loading() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-cream">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-plum/20 border-t-plum" />
    </div>
  );
}
