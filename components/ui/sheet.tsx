"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

/**
 * Thumb-friendly bottom sheet. Renders nothing when closed; closes on
 * backdrop tap or Escape. Rendered through a portal onto <body> so it
 * always overlays the whole viewport — ancestors with filters/transforms
 * (like the blurred header) would otherwise trap `position: fixed`.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-ink/45"
        onClick={onClose}
      />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="animate-rise relative w-full max-w-md rounded-t-3xl border-x-[3px] border-t-[3px] border-ink bg-paper px-4 pt-3 safe-bottom"
      >
        <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-ink/20" />
        {title ? (
          <h2 className="font-display mb-3 text-center text-xl">{title}</h2>
        ) : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
