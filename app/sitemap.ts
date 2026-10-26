import type { MetadataRoute } from "next";
import { listPublicListingIds } from "@/lib/public-listings";
import { listPublishedDesignIds } from "@/lib/showcase-db";
import { SITE_URL } from "@/lib/site";

// Regenerated at most hourly; listings change far less often than that.
export const revalidate = 3600;

// Public, indexable pages: the landing and legal pages, one page per live
// listing, and the showcase with one page per published design. /find,
// /designer and /dashboard are sign-in gated.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    // /pricing and /contact ship in PR #47 (static marketing pages)
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/showcase`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  ];
  // A DB hiccup (or a build without Supabase secrets) must not take the
  // static pages out of the sitemap; the rest returns on the next revalidate.
  const [listings, designs] = await Promise.all([
    listPublicListingIds().catch((err) => {
      console.error("sitemap: listing query failed:", err);
      return [] as Awaited<ReturnType<typeof listPublicListingIds>>;
    }),
    listPublishedDesignIds().catch((err) => {
      console.error("sitemap: design query failed:", err);
      return [] as Awaited<ReturnType<typeof listPublishedDesignIds>>;
    }),
  ]);
  return [
    ...pages,
    ...listings.map((l) => ({
      url: `${SITE_URL}/property/${l.id}`,
      lastModified: new Date(l.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...designs.map((d) => ({
      url: `${SITE_URL}/showcase/${d.id}`,
      lastModified: new Date(d.publishedAt),
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
  ];
}
