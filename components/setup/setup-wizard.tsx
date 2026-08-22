"use client";

import { useState } from "react";

const AVATAR_OPTIONS = [
  { key: "broccoli", label: "🥦 Green" },
  { key: "tomato", label: "🍅 Red" },
  { key: "blueberry", label: "🫐 Purple" },
  { key: "carrot", label: "🥕 Orange" },
  { key: "custard", label: "🍮 Yellow" },
  { key: "plum", label: "🍑 Pink" },
] as const;

type MemberDraft = { name: string; avatarStyle: string; isManager: boolean };

type Links = {
  memberLinks: { name: string; path: string }[];
  managementPath: string;
};

/**
 * One-time household creation. Requires the BOOTSTRAP_TOKEN from the server
 * environment; produces the four member invite links and the management
 * link, shown once with copy buttons.
 */
export function SetupWizard() {
  const [token, setToken] = useState("");
  const [name, setName] = useState("Broccoli Battle");
  const [timezone, setTimezone] = useState("Europe/London");
  const [members, setMembers] = useState<MemberDraft[]>([
    { name: "Mum", avatarStyle: "tomato", isManager: false },
    { name: "Dad", avatarStyle: "broccoli", isManager: true },
    { name: "Cerys", avatarStyle: "blueberry", isManager: false },
    { name: "Evie", avatarStyle: "carrot", isManager: false },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [links, setLinks] = useState<Links | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bootstrapToken: token,
          name,
          timezone,
          members,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error?.message ?? "Setup failed. Check the details.");
        return;
      }
      setLinks({
        memberLinks: data.memberLinks,
        managementPath: data.managementPath,
      });
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (links) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 py-8">
        <h1 className="font-display text-center text-3xl">THE BATTLE BEGINS</h1>
        <p className="text-center text-sm font-bold text-ink-soft">
          Send each person their own link. Opening it binds their phone to
          their name — no logins, ever. These links are shown once; you can
          regenerate them later from management.
        </p>
        {links.memberLinks.map((l) => (
          <CopyRow key={l.path} label={`${l.name}'s invite`} path={l.path} />
        ))}
        <CopyRow
          label="🔧 Spare management link (the team manager's own invite already unlocks settings)"
          path={links.managementPath}
        />
        <a
          href={links.memberLinks[0]?.path ?? "/"}
          className="pressable card-sticker mt-2 block bg-broccoli px-4 py-3 text-center font-display text-xl text-white"
        >
          BIND THIS PHONE & PLAY
        </a>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-5 py-8">
      <div className="text-center">
        <h1 className="font-display text-3xl text-broccoli-dark">
          BROCCOLI BATTLE
        </h1>
        <p className="font-display text-ink-soft">First-time setup</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-display text-sm">Bootstrap token</span>
        <input
          value={token}
          onChange={(e) => setToken(e.target.value)}
          type="password"
          placeholder="From your server environment"
          className="rounded-2xl border-[3px] border-ink bg-paper px-4 py-2.5 font-bold outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-display text-sm">Family name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          className="rounded-2xl border-[3px] border-ink bg-paper px-4 py-2.5 font-bold outline-none"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-display text-sm">Timezone</span>
        <input
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          maxLength={60}
          className="rounded-2xl border-[3px] border-ink bg-paper px-4 py-2.5 font-bold outline-none"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="font-display pb-1 text-sm">The four fighters</legend>
        {members.map((m, i) => (
          <div key={i} className="card-sticker px-3 py-2">
            <div className="flex items-center gap-2">
              <input
                value={m.name}
                maxLength={40}
                aria-label={`Player ${i + 1} name`}
                onChange={(e) =>
                  setMembers((ms) =>
                    ms.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)),
                  )
                }
                className="w-0 flex-1 rounded-xl border-2 border-ink bg-cream px-3 py-1.5 font-bold outline-none"
              />
              <select
                value={m.avatarStyle}
                aria-label={`Player ${i + 1} colour`}
                onChange={(e) =>
                  setMembers((ms) =>
                    ms.map((x, j) =>
                      j === i ? { ...x, avatarStyle: e.target.value } : x,
                    ),
                  )
                }
                className="rounded-xl border-2 border-ink bg-paper px-2 py-1.5 text-sm font-bold outline-none"
              >
                {AVATAR_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-1.5 pt-1.5 text-xs font-bold text-ink-soft">
              <input
                type="radio"
                name="manager"
                checked={m.isManager}
                onChange={() =>
                  setMembers((ms) =>
                    ms.map((x, j) => ({ ...x, isManager: j === i })),
                  )
                }
                className="size-4 accent-broccoli"
              />
              🔧 Team manager — this person&apos;s phone also gets the
              household settings
            </label>
          </div>
        ))}
      </fieldset>

      {error ? (
        <p role="alert" className="card-sticker bg-tomato-light px-4 py-2 text-center text-sm font-bold">
          {error}
        </p>
      ) : null}

      <button
        onClick={submit}
        disabled={busy || !token || members.some((m) => m.name.trim().length === 0)}
        className="pressable card-sticker bg-broccoli px-4 py-3.5 font-display text-2xl text-white disabled:opacity-50"
      >
        {busy ? "Preparing the arena…" : "CREATE THE BATTLE"}
      </button>
    </main>
  );
}

function CopyRow({ label, path }: { label: string; path: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <div className="card-sticker flex items-center gap-2 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="font-display text-sm">{label}</p>
        <p className="truncate text-[11px] font-bold text-ink-soft">{url}</p>
      </div>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // Clipboard may be blocked; the URL is visible to copy manually.
          }
        }}
        className="pressable rounded-xl border-2 border-ink bg-custard px-3 py-1.5 font-display text-xs"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
