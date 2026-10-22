import type { MetadataRoute } from "next";

const SITE = "https://archit.chaudharyankit.in";

// Public, indexable pages only; /find and /designer are sign-in gated.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/refunds`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
