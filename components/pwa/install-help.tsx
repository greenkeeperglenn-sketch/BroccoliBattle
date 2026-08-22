"use client";

import { useState, useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

const subscribeDisplayMode = (onChange: () => void) => {
  const query = window.matchMedia("(display-mode: standalone)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** A tasteful install control inside the member menu — never a nag. */
export function InstallHelp() {
  const standalone = useSyncExternalStore(
    subscribeDisplayMode,
    isStandalone,
    () => true, // assume installed during SSR; corrected on the client
  );
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (standalone) return null;

  const onClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      deferredPrompt = null;
    } else {
      setShowIosHelp((v) => !v);
    }
  };

  return (
    <div>
      <button
        onClick={onClick}
        className="pressable card-sticker block w-full bg-custard-light px-4 py-3 text-center font-display"
      >
        📲 Add to home screen
      </button>
      {showIosHelp ? (
        <p className="px-2 pt-2 text-center text-xs font-bold text-ink-soft">
          In Safari: tap the Share button, then “Add to Home Screen”. Broccoli
          Battle becomes a proper app.
        </p>
      ) : null}
    </div>
  );
}
