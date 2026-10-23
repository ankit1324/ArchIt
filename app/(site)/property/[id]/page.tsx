import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import { feeLabel } from "@/lib/fees";
import { getPublicListing, type PublicListing } from "@/lib/public-listings";
import { SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";

// Public, crawlable listing page. No auth and no owner contact: the contact
// stays behind the paid unlock inside /find, which this page links into.

type Props = { params: Promise<{ id: string }> };

const KIND_LABEL: Record<string, string> = {
  apartments: "Apartment",
  house: "House",
  land: "Plot",
  room: "Room",
  business: "Commercial space",
  hotels: "Hotel",
};

function headline(l: PublicListing): string {
  return l.buildingName || l.address;
}

function kindLabel(l: PublicListing): string {
  return KIND_LABEL[l.kind] ?? "Property";
}

function photosOf(l: PublicListing): string[] {
  return (l.photos ?? []).map((p) => safeImageUrl(p)).filter((p): p is string => !!p);
}

function summary(l: PublicListing): string {
  const deal = l.type === "sale" ? "for sale" : "for rent";
  const facts = [
    l.beds ? `${l.beds} bed` : null,
    l.baths ? `${l.baths} bath` : null,
    l.sqft ? `${l.sqft.toLocaleString("en-IN")} sqft` : null,
  ].filter(Boolean);
  const where = [l.buildingName ? l.address : null, l.city].filter(Boolean).join(", ");
  return `${kindLabel(l)} ${deal}${where ? ` in ${where}` : ""} at ${formatPrice(l)}${
    facts.length ? ` · ${facts.join(" · ")}` : ""
  }. Explore it on ArchIt's 3D map.`;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) return { title: "Listing not found", robots: { index: false } };
  const title = `${headline(l)} — ${l.type === "sale" ? "For sale" : "For rent"}${
    l.city ? ` in ${l.city}` : ""
  }`;
  const description = summary(l);
  const photo = photosOf(l)[0];
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
      // no photo: the suite-wide app/opengraph-image.tsx card is used instead
      ...(photo ? { images: [{ url: photo, alt: headline(l) }] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

/** schema.org RealEstateListing; deliberately has no owner/contact fields. */
function jsonLd(l: PublicListing) {
  const url = `${SITE_URL}/property/${l.id}`;
  const photos = photosOf(l);
  return {
    "@context": "https://schema.org",
    "@type": "RealEstateListing",
    "@id": url,
    url,
    name: headline(l),
    description: summary(l),
    ...(l.createdAt ? { datePosted: l.createdAt } : {}),
    ...(photos.length ? { image: photos } : {}),
    offers: {
      "@type": "Offer",
      price: l.price,
      priceCurrency: "INR",
      businessFunction:
        l.type === "sale"
          ? "http://purl.org/goodrelations/v1#Sell"
          : "http://purl.org/goodrelations/v1#LeaseOut",
    },
    about: {
      "@type": l.kind === "apartments" ? "Apartment" : l.kind === "house" ? "House" : "Place",
      name: `${kindLabel(l)} · ${headline(l)}`,
      address: {
        "@type": "PostalAddress",
        streetAddress: l.address,
        ...(l.city ? { addressLocality: l.city } : {}),
        addressCountry: "IN",
      },
      geo: { "@type": "GeoCoordinates", latitude: l.coords[1], longitude: l.coords[0] },
      ...(l.kind === "apartments" || l.kind === "house"
        ? {
            numberOfBedrooms: l.beds,
            numberOfBathroomsTotal: l.baths,
            floorSize: { "@type": "QuantitativeValue", value: l.sqft, unitCode: "FTK" },
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

export default async function PropertyPage({ params }: Props) {
  // Rendered per request: proxy.ts gives /property the nonce CSP, and listing
  // edits/deletes show up immediately without a revalidation hook.
  await connection();
  const { id } = await params;
  const l = await getPublicListing(id);
  if (!l) notFound();

  const sale = l.type === "sale";
  const photos = photosOf(l);
  // /find is sign-in gated: proxy.ts sends signed-out visitors through sign-in
  // and back to this URL, where ?property= opens this listing's panel.
  const mapHref = `/find?property=${encodeURIComponent(l.id)}`;
  // JSON in a <script> body: escape "<" so listing text can never close the tag.
  const ld = JSON.stringify(jsonLd(l)).replace(/</g, "\\u003c");

  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ld }} />
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 pb-10 pt-8">
        <nav aria-label="Breadcrumb" className="text-[13px] font-semibold text-plum-soft">
          <Link href="/" className="hover:text-plum">ArchIt</Link>
          <span aria-hidden> / </span>
          <span>{l.city || "Listings"}</span>
        </nav>

        <header className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[30px] font-extrabold leading-tight sm:text-[36px]">{headline(l)}</h1>
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
              {sale ? "For Sale" : "For Rent"}
            </span>
          </div>
        </header>

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
            <Fact label="Beds" value={String(l.beds)} />
            <Fact label="Baths" value={String(l.baths)} />
            <Fact label="Floors" value={String(l.floors)} />
            <Fact label="Built-up" value={`${l.sqft.toLocaleString("en-IN")} sqft`} />
            <Fact label="Area" value={`${l.areaM} m²`} />
            <Fact label="Rooms" value={String(l.rooms)} />
            <Fact label="Location" value={`${l.coords[1].toFixed(4)}, ${l.coords[0].toFixed(4)}`} />
          </dl>
        </section>

        <section className="mt-8 rounded-3xl bg-plum p-6 text-cream sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div>
            <h2 className="text-lg font-bold">Interested in this {kindLabel(l).toLowerCase()}?</h2>
            <p className="mt-1 text-[14px] text-cream/85">
              See it in 3D on the map and unlock the owner&apos;s contact for {feeLabel("contact_owner")}.
              Listing is free; you only pay to reach the owner.
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
      </main>
      <Footer />
    </div>
  );
}
