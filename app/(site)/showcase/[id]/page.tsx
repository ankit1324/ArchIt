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
    <div className="flex h-full flex-col bg-cream text-plum">
      <header className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-plum/10 px-4 py-3 sm:px-6">
        <Link href="/" aria-label="ArchIt home" className="text-plum">
          <LogoMark width={28} height={28} />
        </Link>
        <Link
          href="/showcase"
          className="py-1.5 text-[12.5px] font-semibold text-plum-soft transition-colors hover:text-plum"
        >
          ← Showcase
        </Link>
        <div className="min-w-0 flex-1 basis-56">
          <h1 className="truncate text-lg font-extrabold">{d.name}</h1>
          <p className="truncate text-[12.5px] font-medium text-plum-soft">
            by {d.authorName}
            {d.place ? ` · ${d.place}` : ""} · Plot {round1(d.plotW)} × {round1(d.plotD)} m
          </p>
        </div>
        {d.plotCenter && (
          // /find is sign-in gated: proxy.ts sends signed-out visitors through
          // sign-in and back here, where ?design= opens this design's pin
          <Link
            href={`/find?design=${encodeURIComponent(d.id)}`}
            prefetch={false}
            className="inline-flex min-h-10 items-center rounded-full bg-plum px-4 py-2 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
          >
            See on map
          </Link>
        )}
      </header>
      <ShowcaseViewer designId={d.id} name={d.name} />
    </div>
  );
}
