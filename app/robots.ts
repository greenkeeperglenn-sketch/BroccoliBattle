import type { MetadataRoute } from "next";

/** A private family game — nothing here is for search engines. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", disallow: "/" },
  };
}
