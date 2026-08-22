"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Battle", emoji: "⚔️" },
  { href: "/league", label: "League", emoji: "🏆" },
  { href: "/prizes", label: "Prizes", emoji: "🎟️" },
  { href: "/collection", label: "Collection", emoji: "🌈" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t-[3px] border-ink bg-paper safe-bottom"
    >
      <div className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 ${
                active ? "text-ink" : "text-ink-soft"
              }`}
            >
              <span
                className={`text-xl leading-none transition-transform ${active ? "scale-110" : "grayscale-[0.4] opacity-80"}`}
                aria-hidden="true"
              >
                {tab.emoji}
              </span>
              <span
                className={`font-display text-[11px] ${active ? "" : "opacity-70"}`}
              >
                {tab.label}
              </span>
              <span
                className={`h-1 w-8 rounded-full ${active ? "bg-broccoli" : "bg-transparent"}`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
