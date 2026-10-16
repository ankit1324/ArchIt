import type { MetadataRoute } from "next";

const SITE = "https://archit.chaudharyankit.in";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Gated app surfaces and auth screens: nothing useful to crawl.
      disallow: ["/api/", "/find", "/designer", "/sign-in", "/sign-up"],
    },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
