import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { feeLabel } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import ShareButtons from "@/components/ShareButtons";
import {
  cityName,
  getPublicListing,
  listMoreInCity,
  type PublicListing,
} from "@/lib/public-listings";
import { SITE_URL } from "@/lib/site";
import { dealLabel, dealTone, headline, isDwelling, kindLabel, photosOf, priceLabel, shareLine, summary } from "./format";

// Public, crawlable listing page. No auth and no owner contact: the contact
// stays behind the paid unlock inside /find, which this page links into.

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) return { title: "Listing not found", robots: { index: false } };
  const city = cityName(l.city);
  const title = `${headline(l)} — ${
    l.type === "showcase" ? "Showcase" : l.type === "sale" ? "For sale" : "For rent"
  }${
    city ? ` in ${city}` : ""
  }`;
  const description = summary(l);
  return {
    title,
    description,
    alternates: { canonical: `/property/${l.id}` },
    openGraph: {
      type: "website",
      siteName: "ArchIt",
      locale: "en_IN",
      url: `/property/${l.id}`,
      title,
      description,
      // images: the colocated opengraph-image.tsx card (price, deal, city and
      // the first photo). File-based metadata wins over this object anyway.
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** schema.org RealEstateListing; deliberately has no owner/contact fields. */
function jsonLd(l: PublicListing) {
  const url = `${SITE_URL}/property/${l.id}`;
  const photos = photosOf(l);
  const pin = /\b\d{6}\b/.exec(l.city ?? "")?.[0];
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: headline(l),
    description: summary(l),
    ...(l.createdAt ? { datePosted: l.createdAt } : {}),
    ...(photos.length ? { image: photos } : {}),
    // a showcase listing is not on the market: no offer to describe
    ...(l.type === "showcase"
      ? {}
      : {
          offers: {
            "@type": "Offer",
            price: l.price,
            priceCurrency: "INR",
            businessFunction:
              l.type === "sale"
                ? "http://purl.org/goodrelations/v1#Sell"
                : "http://purl.org/goodrelations/v1#LeaseOut",
          },
        }),
    about: {
      "@type": l.kind === "apartments" ? "Apartment" : l.kind === "house" ? "House" : "Place",
      name: `${kindLabel(l)} · ${headline(l)}`,
      address: {
        "@type": "PostalAddress",
        streetAddress: l.address,
        // stored city is "Chandigarh, 160015": split it into locality + PIN
        ...(cityName(l.city) ? { addressLocality: cityName(l.city) } : {}),
        ...(pin ? { postalCode: pin } : {}),
        addressCountry: "IN",
      },
      geo: { "@type": "GeoCoordinates", latitude: l.coords[1], longitude: l.coords[0] },
      // Accommodation-only properties, and only real values: a 0 here is
      // "not entered", which schema.org consumers would read as a fact.
      ...(l.kind === "apartments" || l.kind === "house"
        ? {
            ...(l.beds > 0 ? { numberOfBedrooms: l.beds } : {}),
            ...(l.baths > 0 ? { numberOfBathroomsTotal: l.baths } : {}),
            ...(l.sqft > 0
              ? { floorSize: { "@type": "QuantitativeValue", value: l.sqft, unitCode: "FTK" } }
              : {}),
          }
        : {}),
    },
  };
}

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const EYEBROW = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-line pt-3">
      <dt className={EYEBROW}>{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** Compact card for the "More in <city>" grid, in the landing's starter-card style. */
function MoreCard({ l }: { l: PublicListing }) {
  const photo = photosOf(l)[0];
  return (
    <li>
      <Link
        href={`/property/${encodeURIComponent(l.id)}`}
        className={`group block h-full overflow-hidden rounded-md border border-line bg-paper-soft transition-colors hover:border-line-strong ${FOCUS}`}
      >
        <div className="relative aspect-[4/3] border-b border-line bg-[#e7ece4]">
          {photo && (
            <Image
              src={photo}
              alt=""
              fill
              sizes="(min-width: 896px) 200px, 50vw"
              className="object-cover"
            />
          )}
          <span
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${dealTone(l)}`}
          >
            {dealLabel(l)}
          </span>
        </div>
        <div className="px-3 py-3">
          <p className="text-[15px] font-semibold tabular-nums">{priceLabel(l)}</p>
          <p className="mt-0.5 truncate text-[14px] text-ink-soft group-hover:text-ink">
            {headline(l)}
          </p>
        </div>
      </Link>
    </li>
  );
}

export default async function PropertyPage({ params }: Props) {
  // Rendered per request: proxy.ts gives /property the nonce CSP, and listing
  // edits/deletes show up immediately without a revalidation hook.
  await connection();
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) notFound();
  const more = await listMoreInCity(l);

  const photos = photosOf(l);
  const city = cityName(l.city);
  const dwelling = isDwelling(l);
  // /find is sign-in gated: proxy.ts sends signed-out visitors through sign-in
  // and back to this URL, where ?property= opens this listing's panel.
  const mapHref = `/find?property=${encodeURIComponent(l.id)}`;
  // Shares always carry the canonical URL, never a preview/dev origin.
  const shareUrl = `${SITE_URL}/property/${encodeURIComponent(l.id)}`;
  // JSON in a <script> body: escape "<" so listing text can never close the tag.
  const ld = JSON.stringify(jsonLd(l)).replace(/</g, "\\u003c");

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <Navbar />
      <main className="mx-auto w-full max-w-5xl px-6 pb-16 pt-8 sm:px-8 sm:pt-10">
        <nav aria-label="Breadcrumb" className={EYEBROW}>
          <Link href="/" className={`inline-flex min-h-6 items-center hover:text-accent ${FOCUS}`}>ArchIt</Link>
          <span aria-hidden className="mx-2 text-line-strong">/</span>
          <span>{city || "Listings"}</span>
        </nav>

        <header className="mt-5 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-end sm:gap-10">
          <div className="min-w-0">
            <p className={`flex items-center gap-2 ${EYEBROW}`}>
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
              {kindLabel(l)}
            </p>
            <h1 className="mt-3 break-words font-display text-[34px] font-normal leading-[1.1] tracking-[-0.03em] sm:text-[48px]">
              {headline(l)}
            </h1>
            <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">
              {l.buildingName ? `${l.address}, ` : ""}
              {l.city}
            </p>
          </div>
          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
            <span className="font-display text-[28px] font-normal tabular-nums leading-none tracking-[-0.02em] sm:text-[32px]">
              {priceLabel(l)}
            </span>
            <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${dealTone(l)}`}>
              {dealLabel(l)}
            </span>
          </div>
        </header>

        {/* Above the fold on phones: the two things a shared-link visitor does. */}
        <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-line pt-6">
          <Link
            href={mapHref}
            prefetch={false}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-6 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep sm:mr-2 sm:w-auto ${FOCUS}`}
          >
            View on the 3D map <span aria-hidden>↗</span>
          </Link>
          <ShareButtons url={shareUrl} title={shareLine(l)} />
        </div>

        {photos.length > 0 ? (
          <div className="mt-8 grid gap-2 sm:grid-cols-[2fr_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-md border border-line bg-paper-soft sm:row-span-2">
              <Image
                src={photos[0]}
                alt={`${headline(l)}, ${l.city}`}
                fill
                priority
                sizes="(min-width: 1024px) 640px, 100vw"
                className="object-cover"
              />
            </div>
            {photos.slice(1, 3).map((src, i) => (
              <div key={src} className="relative hidden aspect-[4/3] overflow-hidden rounded-md border border-line bg-paper-soft sm:block">
                <Image
                  src={src}
                  alt={`${headline(l)} — photo ${i + 2}`}
                  fill
                  sizes="320px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          // No photos: a drafting-grid plate holds the space instead of a blank box.
          <div
            className="mt-8 aspect-[16/7] rounded-md border border-line bg-paper-soft bg-[linear-gradient(var(--color-line)_1px,transparent_1px),linear-gradient(90deg,var(--color-line)_1px,transparent_1px)] bg-[size:22px_22px]"
            aria-hidden
          />
        )}

        <section aria-labelledby="facts-title" className="mt-12">
          <h2 id="facts-title" className="font-display text-[26px] font-normal tracking-[-0.02em]">Details</h2>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            <Fact label="Type" value={kindLabel(l)} />
            {/* A plot or shop has no beds/baths: skip rows that would read "0". */}
            {dwelling && l.beds > 0 && <Fact label="Beds" value={String(l.beds)} />}
            {dwelling && l.baths > 0 && <Fact label="Baths" value={String(l.baths)} />}
            {l.floors > 0 && <Fact label="Floors" value={String(l.floors)} />}
            {l.sqft > 0 && <Fact label="Built-up" value={`${l.sqft.toLocaleString("en-IN")} sqft`} />}
            {l.areaM > 0 && <Fact label="Area" value={`${l.areaM.toLocaleString("en-IN")} m²`} />}
            {dwelling && l.rooms > 0 && <Fact label="Rooms" value={String(l.rooms)} />}
            <Fact label="Location" value={`${l.coords[1].toFixed(4)}, ${l.coords[0].toFixed(4)}`} />
          </dl>
        </section>

        <section className="mt-12 rounded-md bg-forest px-6 py-8 text-paper sm:flex sm:items-center sm:justify-between sm:gap-8 sm:px-10">
          <div>
            <h2 className="font-display text-[26px] font-normal tracking-[-0.02em]">
              Interested in this {kindLabel(l).toLowerCase()}?
            </h2>
            <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-paper/85">
              {PAYWALL_ENABLED ? (
                <>
                  See it in 3D on the map and unlock the owner&apos;s contact for {feeLabel("contact_owner")}.
                  Listing is free; you only pay to reach the owner.
                </>
              ) : (
                <>See it in 3D on the map and get the owner&apos;s contact. Free to sign up.</>
              )}
            </p>
          </div>
          <Link
            href={mapHref}
            prefetch={false}
            className="mt-5 inline-flex min-h-11 shrink-0 items-center gap-6 rounded-[5px] bg-paper px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-paper-soft focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-paper sm:mt-0"
          >
            Open on the 3D map <span aria-hidden>↗</span>
          </Link>
        </section>

        {more.length > 0 && (
          <section aria-labelledby="more-title" className="mt-12">
            <h2 id="more-title" className="font-display text-[26px] font-normal tracking-[-0.02em]">More in {city}</h2>
            <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {more.map((m) => (
                <MoreCard key={m.id} l={m} />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-12 flex flex-col items-start gap-5 rounded-md border border-line bg-[#e7ece4] p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-display text-[22px] font-normal tracking-[-0.02em]">
              Have a property{city ? ` in ${city}` : ""}?
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
              List it free on ArchIt and let buyers explore it on the 3D map.
            </p>
          </div>
          {/* /find is where "+ Add property" lives; signed-out visitors sign in first. */}
          <Link
            href="/find"
            prefetch={false}
            className={`inline-flex min-h-11 shrink-0 items-center gap-6 rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink ${FOCUS}`}
          >
            List your property free <span aria-hidden>↗</span>
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
