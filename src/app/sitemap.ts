import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/seo/site-url";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = publicSiteUrl();
  return siteUrl ? [{ url: siteUrl.href, changeFrequency: "monthly", priority: 1 }] : [];
}
