import type { MetadataRoute } from "next";

function getSiteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.ROLE_RADAR_BASE_URL?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const siteUrl = getSiteUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/watchlist", "/sources", "/en/watchlist", "/zh/watchlist", "/en/sources", "/zh/sources"]
      }
    ],
    sitemap: `${siteUrl}/sitemap.xml`
  };
}
