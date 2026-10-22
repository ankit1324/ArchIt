import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Gated app surfaces and auth screens: nothing useful to crawl.
      // /property/:id stays crawlable — those are the public listing pages.
      disallow: ["/api/", "/find", "/designer", "/dashboard", "/sign-in", "/sign-up"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
