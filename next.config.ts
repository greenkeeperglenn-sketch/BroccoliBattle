import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (embedded Postgres fallback) and pg ship native/wasm assets that
  // must not be bundled by webpack/turbopack.
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
  images: {
    // Food artwork lives in Vercel Blob; sizes are small, so allow remote blobs.
    remotePatterns: [
      { protocol: "https", hostname: "*.public.blob.vercel-storage.com" },
    ],
  },
  headers: async () => [
    {
      source: "/sw.js",
      headers: [
        { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ],
    },
  ],
};

export default nextConfig;
