import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SWRegister } from "@/components/pwa/sw-register";

export const metadata: Metadata = {
  title: "Broccoli Battle",
  description: "Fruit. Veg. Glory. The family five-a-day battle game.",
  applicationName: "Broccoli Battle",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Broccoli Battle",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#2f9e44",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh antialiased">
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
