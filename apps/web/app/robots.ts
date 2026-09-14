import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.senddox.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app/", "/api/", "/sign/"],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
