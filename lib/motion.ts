const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Preserve a camera transition unless the visitor asked for reduced motion. */
export function motionDuration(duration: number, reduced?: boolean): number {
  const shouldReduce =
    reduced ??
    (typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia(REDUCED_MOTION_QUERY).matches);
  return shouldReduce ? 0 : duration;
}
