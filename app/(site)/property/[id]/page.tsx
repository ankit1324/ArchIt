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
import { formatPrice } from "@/lib/types";
import { dealLabel, headline, isDwelling, kindLabel, photosOf, shareLine, summary } from "./format";

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

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-plum-soft">{label}</dt>
      <dd className="mt-0.5 text-[15px] font-bold text-plum">{value}</dd>
    </div>
  );
}

/** Compact card for the "More in <city>" grid. */
function MoreCard({ l }: { l: PublicListing }) {
  const sale = l.type === "sale";
  const photo = photosOf(l)[0];
  return (
    <li>
      <Link
        href={`/property/${encodeURIComponent(l.id)}`}
        className="group block overflow-hidden rounded-3xl bg-white/60 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
      >
        <div className="relative aspect-[4/3] bg-gradient-to-br from-plum-soft to-plum">
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
            className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              sale ? "bg-lime text-plum" : "bg-magenta-deep text-white"
            }`}
          >
            {dealLabel(l)}
          </span>
        </div>
        <div className="px-3 py-2.5">
          <p className="text-[15px] font-extrabold">{formatPrice(l)}</p>
          <p className="truncate text-[13px] font-semibold text-plum-soft group-hover:text-plum">
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

  const sale = l.type === "sale";
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
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pb-10 pt-8 sm:px-6">
        <nav aria-label="Breadcrumb" className="text-[13px] font-semibold text-plum-soft">
          <Link href="/" className="hover:text-plum">ArchIt</Link>
          <span aria-hidden> / </span>
          <span>{city || "Listings"}</span>
        </nav>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="break-words text-[28px] font-extrabold leading-tight sm:text-[36px]">{headline(l)}</h1>
            <p className="mt-1 text-[15px] font-medium text-plum-soft">
              {l.buildingName ? `${l.address}, ` : ""}
              {l.city}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-2 py-1 text-[20px] font-extrabold ${
                sale ? "bg-lime text-plum" : "bg-magenta-deep text-white"
              }`}
            >
              {formatPrice(l)}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-bold ${
                sale ? "bg-lime text-plum" : "bg-magenta-deep text-white"
              }`}
            >
              {dealLabel(l)}
            </span>
          </div>
        </header>

        {/* Above the fold on phones: the two things a shared-link visitor does. */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            href={mapHref}
            prefetch={false}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-full bg-plum px-5 py-2 text-[14px] font-bold text-cream transition-opacity hover:opacity-90 sm:w-auto"
          >
            View on the 3D map →
          </Link>
          <ShareButtons url={shareUrl} title={shareLine(l)} />
        </div>

        {photos.length > 0 ? (
          <div className="mt-6 grid gap-2 sm:grid-cols-[2fr_1fr]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl sm:row-span-2">
              <Image
                src={photos[0]}
                alt={`${headline(l)}, ${l.city}`}
                fill
                priority
                sizes="(min-width: 896px) 560px, 100vw"
                className="object-cover"
              />
            </div>
            {photos.slice(1, 3).map((src, i) => (
              <div key={src} className="relative hidden aspect-[4/3] overflow-hidden rounded-3xl sm:block">
                <Image
                  src={src}
                  alt={`${headline(l)} — photo ${i + 2}`}
                  fill
                  sizes="280px"
                  className="object-cover"
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-6 aspect-[16/7] rounded-3xl bg-gradient-to-br from-plum-soft to-plum" aria-hidden />
        )}

        <section aria-labelledby="facts-title" className="mt-8">
          <h2 id="facts-title" className="text-lg font-bold">Details</h2>
          <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
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

        <section className="mt-8 rounded-3xl bg-plum p-6 text-cream sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-lg font-bold">Interested in this {kindLabel(l).toLowerCase()}?</h2>
            <p className="mt-1 text-[14px] text-cream/85">
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
            className="mt-4 inline-block shrink-0 rounded-full bg-cream px-6 py-3 text-[14px] font-bold text-plum transition-opacity hover:opacity-90 sm:mt-0"
          >
            Open on the 3D map →
          </Link>
        </section>

        {more.length > 0 && (
          <section aria-labelledby="more-title" className="mt-10">
            <h2 id="more-title" className="text-lg font-bold">More in {city}</h2>
            <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {more.map((m) => (
                <MoreCard key={m.id} l={m} />
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10 flex flex-col items-start gap-3 rounded-3xl bg-lime p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Have a property{city ? ` in ${city}` : ""}?</h2>
            <p className="mt-1 text-[14px] text-plum-soft">
              List it free on ArchIt and let buyers explore it on the 3D map.
            </p>
          </div>
          {/* /find is where "+ Add property" lives; signed-out visitors sign in first. */}
          <Link
            href="/find"
            prefetch={false}
            className="inline-block shrink-0 rounded-full bg-plum px-6 py-3 text-[14px] font-bold text-cream transition-opacity hover:opacity-90"
          >
            List your property free →
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
