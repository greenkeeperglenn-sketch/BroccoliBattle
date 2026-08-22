import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Broccoli Battle",
    short_name: "Broccoli",
    description: "Fruit. Veg. Glory. The family five-a-day battle game.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fdf4e3",
    theme_color: "#2f9e44",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
