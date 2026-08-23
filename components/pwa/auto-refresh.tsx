"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 15_000;

/**
 * Keeps scores live without anyone restarting the app:
 * — refreshes server data whenever the app returns to the foreground
 *   (switching back to the PWA, waking the phone, re-focusing the tab),
 * — refreshes every 15 seconds while the screen is visible.
 *
 * router.refresh() re-renders server components only; in-progress client
 * interactions (open sheets, a portion being picked) are untouched.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible" && navigator.onLine !== false) {
        router.refresh();
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    const timer = setInterval(refresh, INTERVAL_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
