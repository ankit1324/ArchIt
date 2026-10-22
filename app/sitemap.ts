import type { MetadataRoute } from "next";
import { listPublicListingIds } from "@/lib/public-listings";
import { SITE_URL } from "@/lib/site";

// Regenerated at most hourly; listings change far less often than that.
export const revalidate = 3600;

// Public, indexable pages: the landing and legal pages plus one page per live
// listing. /find, /designer and /dashboard are sign-in gated.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    // /pricing and /contact ship in PR #47 (static marketing pages)
    { url: `${SITE_URL}/pricing`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/contact`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  ];
  let listings: Awaited<ReturnType<typeof listPublicListingIds>> = [];
  try {
    listings = await listPublicListingIds();
  } catch (err) {
    // A DB hiccup (or a build without Supabase secrets) must not take the
    // static pages out of the sitemap; listings return on the next revalidate.
    console.error("sitemap: listing query failed:", err);
  }
  return [
    ...pages,
    ...listings.map((l) => ({
      url: `${SITE_URL}/property/${l.id}`,
      lastModified: new Date(l.createdAt),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  ];
}
