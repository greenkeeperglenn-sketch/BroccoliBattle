"use client";

import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Sheet } from "@/components/ui/sheet";
import { InstallHelp } from "@/components/pwa/install-help";

export function AppHeader({
  memberName,
  avatarStyle,
  householdName,
  version,
}: {
  memberName: string;
  avatarStyle: string;
  householdName: string;
  version?: string;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 border-b-[3px] border-ink bg-cream/95 backdrop-blur">
      <div className="mx-auto flex max-w-md items-center justify-between px-4 py-2.5">
        <div className="leading-none">
          <p className="font-display text-lg tracking-wide text-broccoli-dark">
            BROCCOLI BATTLE
          </p>
          <p className="text-[11px] font-bold text-ink-soft">
            Fruit. Veg. Glory.
          </p>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="pressable flex items-center gap-1.5 rounded-full border-[2.5px] border-ink bg-paper py-1 pl-1 pr-2.5 shadow-sticker-sm"
          aria-label={`You are ${memberName}. Open menu`}
        >
          <Avatar name={memberName} style={avatarStyle} size="sm" />
          <span className="font-display text-sm">{memberName}</span>
          <span aria-hidden="true" className="text-[10px] text-ink-soft">▾</span>
        </button>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={memberName}>
        <div className="flex flex-col items-center gap-1 pb-2">
          <Avatar name={memberName} style={avatarStyle} size="xl" />
          <p className="text-sm font-bold text-ink-soft">
            Playing for {householdName}
          </p>
        </div>
        <div className="flex flex-col gap-2 pb-4">
          <InstallHelp />
          <a
            href="/manage"
            className="pressable card-sticker block px-4 py-3 text-center font-display"
          >
            🔧 Household settings
          </a>
          <p className="px-2 pt-1 text-center text-xs text-ink-soft">
            This phone is bound to {memberName}. To move to a new phone, open
            your invite link there.
          </p>
          {version ? (
            <p className="pt-1 text-center text-[10px] font-bold text-ink-soft/60">
              Version {version}
            </p>
          ) : null}
        </div>
      </Sheet>
    </header>
  );
}
