/**
 * Artwork blob storage. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set.
 * Stored files are immutable and versioned (slug-vN.png) — regeneration
 * writes a new version rather than mutating an old one.
 */
export async function storeArtwork(
  filename: string,
  bytes: Buffer,
): Promise<string> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    throw new Error("BLOB_READ_WRITE_TOKEN is not configured");
  }
  const { put } = await import("@vercel/blob");
  const result = await put(`food-art/${filename}`, bytes, {
    access: "public",
    contentType: "image/png",
    addRandomSuffix: false,
    cacheControlMaxAge: 60 * 60 * 24 * 365,
  });
  return result.url;
}
