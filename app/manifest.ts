import type { MetadataRoute } from "next";

// Installable shell for the suite. Icons are generated from the landing-page
// house mark (public/icons, app/icon.png, app/apple-icon.png).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ArchIt — Plan your home in 3D",
    short_name: "ArchIt",
    description:
      "Plan your plot, lay out rooms and explore your home in 3D. Find properties on a living 3D map.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f8f7f2",
    theme_color: "#f8f7f2",
    categories: ["lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
