import type { MetadataRoute } from "next";
import { db } from "@/lib/db";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const statiques = [
    { url: "/", priority: 1, changeFrequency: "daily" as const },
    { url: "/motos", priority: 0.9, changeFrequency: "daily" as const },
    { url: "/comment-ca-marche", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/faq", priority: 0.7, changeFrequency: "monthly" as const },
    { url: "/a-propos", priority: 0.5, changeFrequency: "monthly" as const },
    { url: "/contact", priority: 0.6, changeFrequency: "monthly" as const },
    { url: "/cgv", priority: 0.3, changeFrequency: "yearly" as const },
    { url: "/mentions-legales", priority: 0.2, changeFrequency: "yearly" as const },
  ].map((s) => ({ ...s, url: `${SITE}${s.url}`, lastModified: new Date() }));

  let fiches: MetadataRoute.Sitemap = [];
  try {
    const slugs = await db().slugsPublies();
    fiches = slugs.map(({ slug, updated_at }) => ({
      url: `${SITE}/motos/${slug}`,
      lastModified: new Date(updated_at),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    /* le sitemap ne doit jamais faire echouer le build */
  }

  return [...statiques, ...fiches];
}
