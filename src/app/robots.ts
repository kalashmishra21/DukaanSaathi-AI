import type { MetadataRoute } from "next";
import { publicSiteUrl } from "@/lib/seo/site-url";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = publicSiteUrl();
  return siteUrl ? {
    rules: { userAgent: "*", allow: "/", disallow: ["/app", "/signin", "/sign-in", "/auth/", "/api/"] },
    sitemap: new URL("/sitemap.xml", siteUrl).href,
  } : { rules: { userAgent: "*", disallow: "/" } };
}
