import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-cream px-6">
      <div className="glass w-full max-w-sm rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-plum/10 text-2xl">
          🧭
        </div>
        <h2 className="text-lg font-extrabold text-plum">Page not found</h2>
        <p className="mt-2 text-[13.5px] font-medium text-plum-soft">
          We couldn&apos;t find what you were looking for. It may have moved
          or never existed.
        </p>
        <Link
          href="/find"
          className="mt-6 inline-block w-full rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
        >
          Go to the map
        </Link>
      </div>
    </div>
  );
}
