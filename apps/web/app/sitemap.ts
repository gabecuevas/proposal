import type { MetadataRoute } from "next";
import { MARKETING_TEMPLATE_CATEGORIES, MARKETING_TEMPLATES } from "@/lib/marketing/template-library";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://www.senddox.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = ["", "/product", "/pricing", "/security", "/templates", "/blog", "/contact", "/signup", "/login"].map(
    (path) => ({
      url: `${siteUrl}${path || "/"}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: path === "" ? 1 : 0.7,
    }),
  );

  const categories = MARKETING_TEMPLATE_CATEGORIES.map((category) => ({
    url: `${siteUrl}/templates/${category.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const templates = MARKETING_TEMPLATES.map((template) => ({
    url: `${siteUrl}/templates/${template.categorySlug}/${template.slug}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: template.wave1 ? 0.9 : 0.75,
  }));

  return [...staticRoutes, ...categories, ...templates];
}
