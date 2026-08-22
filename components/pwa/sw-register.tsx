"use client";

import { useEffect } from "react";

/** Registers the service worker for offline caching. */
export function SWRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Offline caching is a nicety; the app works without it.
      });
    }
  }, []);
  return null;
}
