import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { LogoMark } from "@/components/icons";
import { round1 } from "@/lib/showcase";
import { getPublishedDesign } from "@/lib/showcase-db";
import { safeImageUrl } from "@/lib/url";
import ShowcaseViewer from "./ShowcaseViewer";

// Public read-only page for one published design: its details, rendered here,
// and the builder in view mode underneath (ShowcaseViewer). A private or
// missing design is a 404 for everyone, its owner included. Rendered per
// request (auth() reads the request; proxy.ts gives /showcase the nonce CSP).

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const d = await getPublishedDesign(id, null).catch(() => null);
  if (!d) return { title: "Design not found", robots: { index: false } };
  const title = `${d.name} by ${d.authorName}`;
  const description = `A ${round1(d.plotW)} × ${round1(d.plotD)} m home designed on ArchIt${
    d.place ? ` — ${d.place}` : ""
  }. Walk around it in 3D in your browser.`;
  const image = safeImageUrl(d.snapshot);
  return {
    title,
    description,
    alternates: { canonical: `/showcase/${d.id}` },
    openGraph: {
      type: "website",
      siteName: "ArchIt",
      locale: "en_IN",
      url: `/showcase/${d.id}`,
      title,
      description,
      ...(image ? { images: [{ url: image, alt: d.name }] } : {}),
    },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
  };
}

export default async function ShowcaseDesignPage({ params }: Props) {
  const { id } = await params;
  const { userId } = await auth();
  // list projection only: the design JSON is fetched by the viewer itself
  const d = await getPublishedDesign(id, userId);
  if (!d) notFound();

  return (
    // Fills the viewport rather than scrolling: the builder below owns its
    // own gestures, so the header stays compact and the iframe takes the rest.
    <div className="flex h-full flex-col bg-paper text-ink">
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-line px-[clamp(16px,3vw,40px)] py-3">
        <Link
          href="/"
          aria-label="ArchIt home"
          className="flex items-center gap-2 text-[20px] font-extrabold tracking-[-0.05em] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <LogoMark width={24} height={24} className="text-accent" />
          <span aria-hidden>
            ArchIt<span className="text-accent">.</span>
          </span>
        </Link>
        <Link
          href="/showcase"
          className="inline-flex min-h-6 items-center text-[13px] font-semibold text-ink-soft underline-offset-4 transition-colors hover:text-ink hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          ← Showcase
        </Link>
        <div className="min-w-0 flex-1 basis-56 border-line sm:border-l sm:pl-6">
          <h1 className="truncate font-display text-[22px] font-normal leading-tight tracking-[-0.02em]">{d.name}</h1>
          <p className="truncate text-[14px] text-ink-soft">
            by {d.authorName}
            {d.place ? ` · ${d.place}` : ""} · <span className="tabular-nums">Plot {round1(d.plotW)} × {round1(d.plotD)} m</span>
          </p>
        </div>
        {d.plotCenter && (
          // /find is sign-in gated: proxy.ts sends signed-out visitors through
          // sign-in and back here, where ?design= opens this design's pin
          <Link
            href={`/find?design=${encodeURIComponent(d.id)}`}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-4 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            See on map <span aria-hidden>↗</span>
          </Link>
        )}
      </header>
      <main className="flex min-h-0 flex-1 flex-col">
        <ShowcaseViewer designId={d.id} name={d.name} />
      </main>
    </div>
  );
}
