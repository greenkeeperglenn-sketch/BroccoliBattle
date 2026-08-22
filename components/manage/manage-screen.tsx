"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";

/**
 * Household management: family, prize wheel, food catalogue, game settings
 * and maintenance. Deliberately plainer than the game — but still on brand.
 * There is intentionally NO manual weekly-challenge selection here: the
 * weekly battle is always a random draw.
 */

type Props = {
  household: { name: string; timezone: string; weeklyFamilyTarget: number };
  members: { id: string; name: string; avatarStyle: string; active: boolean }[];
  prizes: {
    id: string;
    title: string;
    description: string | null;
    emoji: string;
    weight: number;
    active: boolean;
  }[];
  foods: {
    id: string;
    name: string;
    category: string;
    emoji: string;
    source: string;
    active: boolean;
    iconStatus: string;
  }[];
  challenges: { id: string; name: string; emoji: string; active: boolean }[];
  cashedTickets: { id: string; title: string; emoji: string; member: string }[];
  artworkAvailable: boolean;
  textAIAvailable: boolean;
};

async function post(url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) {
    throw new Error(
      (data as { error?: { message?: string } })?.error?.message ?? "Request failed",
    );
  }
  return data as Record<string, unknown>;
}

export function ManageScreen(props: Props) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [freshInvite, setFreshInvite] = useState<{ name: string; url: string } | null>(null);

  const act = async (fn: () => Promise<void>) => {
    setMessage(null);
    try {
      await fn();
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 px-4 py-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">🔧 Management</h1>
        <Link href="/" className="font-display text-sm text-blueberry underline">
          ← Back to battle
        </Link>
      </div>

      {message ? (
        <p role="alert" className="card-sticker bg-tomato-light px-4 py-2 text-sm font-bold">
          {message}
        </p>
      ) : null}
      {freshInvite ? (
        <div className="card-sticker bg-custard-light px-4 py-3">
          <p className="font-display text-sm">New invite for {freshInvite.name}</p>
          <p className="break-all text-xs font-bold text-ink-soft">{freshInvite.url}</p>
          <button
            className="pressable mt-2 rounded-xl border-2 border-ink bg-custard px-3 py-1.5 font-display text-xs"
            onClick={() => navigator.clipboard?.writeText(freshInvite.url)}
          >
            Copy link
          </button>
          <p className="pt-1 text-[11px] font-bold text-ink-soft">
            Shown once — the old link no longer works.
          </p>
        </div>
      ) : null}

      {/* ── Family ── */}
      <Section title="👨‍👩‍👧‍👧 Family" open>
        {props.members.map((m) => (
          <MemberRow
            key={m.id}
            member={m}
            onRename={(name) =>
              act(() => post("/api/manage/members", { action: "rename", memberId: m.id, name }).then(() => {}))
            }
            onToggle={() =>
              act(() => post("/api/manage/members", { action: "setActive", memberId: m.id, active: !m.active }).then(() => {}))
            }
            onRegenerate={() =>
              act(async () => {
                const data = await post("/api/manage/members", {
                  action: "regenerateInvite",
                  memberId: m.id,
                });
                setFreshInvite({
                  name: m.name,
                  url: `${window.location.origin}${data.path as string}`,
                });
              })
            }
          />
        ))}
      </Section>

      {/* ── Prize wheel ── */}
      <Section title="🎡 Prize wheel">
        {props.prizes.map((p) => (
          <PrizeRow
            key={p.id}
            prize={p}
            onSave={(changes) =>
              act(() => post("/api/manage/prizes", { action: "update", prizeId: p.id, ...changes }).then(() => {}))
            }
          />
        ))}
        <NewPrizeForm
          onCreate={(prize) =>
            act(() => post("/api/manage/prizes", { action: "create", ...prize }).then(() => {}))
          }
        />
      </Section>

      {/* ── Food catalogue ── */}
      <Section title="🥕 Food catalogue">
        <FoodList
          foods={props.foods}
          artworkAvailable={props.artworkAvailable}
          onToggle={(food) =>
            act(() => post("/api/manage/foods", { action: "setActive", foodId: food.id, active: !food.active }).then(() => {}))
          }
          onRegenerate={(food) =>
            act(() => post("/api/manage/foods", { action: "generateArt", foodId: food.id }).then(() => {}))
          }
        />
      </Section>

      {/* ── Game settings ── */}
      <Section title="🎮 Game">
        <GameSettings
          household={props.household}
          onSave={(changes) => act(() => post("/api/manage/household", changes).then(() => {}))}
        />
        <p className="font-display pt-3 text-xs text-ink-soft">WEEKLY CHALLENGES IN THE DRAW</p>
        {props.challenges.map((c) => (
          <label key={c.id} className="flex items-center justify-between py-1.5 text-sm font-bold">
            <span>
              {c.emoji} {c.name}
            </span>
            <input
              type="checkbox"
              checked={c.active}
              onChange={() =>
                act(() => post("/api/manage/household", { challenge: { id: c.id, active: !c.active } }).then(() => {}))
              }
              className="size-5 accent-broccoli"
            />
          </label>
        ))}
        <p className="pt-1 text-[11px] font-bold text-ink-soft">
          Each week&apos;s battle is drawn at random from the ticked
          challenges. Nobody picks. That&apos;s the point.
        </p>
      </Section>

      {/* ── Maintenance ── */}
      <Section title="🛠️ Maintenance">
        <button
          className="pressable card-sticker w-full px-4 py-2.5 text-left text-sm font-bold"
          onClick={() =>
            act(async () => {
              await fetch("/api/reconcile", { method: "POST" });
              setMessage("Reconciliation complete — weeks are in order.");
            })
          }
        >
          🔄 Run weekly reconciliation now
        </button>
        <div className="pt-2 text-xs font-bold text-ink-soft">
          <p>Artwork generation: {props.artworkAvailable ? "✅ configured" : "— not configured (emoji placeholders in use)"}</p>
          <p>Text AI: {props.textAIAvailable ? "✅ configured" : "— not configured (templated reports in use)"}</p>
        </div>
        {props.cashedTickets.length > 0 ? (
          <>
            <p className="font-display pt-3 text-xs text-ink-soft">
              REPAIR AN ACCIDENTAL CASH-IN
            </p>
            {props.cashedTickets.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1 text-sm font-bold">
                <span>
                  {t.emoji} {t.title} <span className="text-xs text-ink-soft">({t.member})</span>
                </span>
                <button
                  className="pressable rounded-xl border-2 border-ink bg-paper px-2.5 py-1 text-xs"
                  onClick={() =>
                    act(() => post("/api/manage/repair", { action: "restoreTicket", ticketId: t.id }).then(() => {}))
                  }
                >
                  Restore
                </button>
              </div>
            ))}
          </>
        ) : null}
      </Section>
    </main>
  );
}

function Section({
  title,
  open = false,
  children,
}: {
  title: string;
  open?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card-sticker overflow-hidden" open={open}>
      <summary className="font-display cursor-pointer select-none list-none border-ink bg-cream px-4 py-3 text-lg [&::-webkit-details-marker]:hidden">
        {title}
      </summary>
      <div className="border-t-[3px] border-ink px-4 py-3">{children}</div>
    </details>
  );
}

function MemberRow({
  member,
  onRename,
  onToggle,
  onRegenerate,
}: {
  member: { id: string; name: string; avatarStyle: string; active: boolean };
  onRename: (name: string) => void;
  onToggle: () => void;
  onRegenerate: () => void;
}) {
  const [name, setName] = useState(member.name);
  return (
    <div className="border-b-2 border-ink/10 py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <Avatar name={member.name} style={member.avatarStyle} size="sm" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={40}
          aria-label={`Name for ${member.name}`}
          className="w-0 flex-1 rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none"
        />
        {name !== member.name ? (
          <button
            onClick={() => onRename(name)}
            className="pressable rounded-xl border-2 border-ink bg-broccoli px-2.5 py-1.5 text-xs font-bold text-white"
          >
            Save
          </button>
        ) : null}
      </div>
      <div className="flex gap-3 pt-1.5 pl-9 text-xs font-bold">
        <button onClick={onRegenerate} className="text-blueberry underline">
          Regenerate invite link
        </button>
        <button onClick={onToggle} className="text-ink-soft underline">
          {member.active ? "Deactivate" : "Reactivate"}
        </button>
      </div>
    </div>
  );
}

function PrizeRow({
  prize,
  onSave,
}: {
  prize: { id: string; title: string; description: string | null; emoji: string; weight: number; active: boolean };
  onSave: (changes: { title?: string; emoji?: string; weight?: number; active?: boolean; description?: string }) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(prize.title);
  const [emoji, setEmoji] = useState(prize.emoji);
  const [weight, setWeight] = useState(prize.weight);
  return (
    <div className={`border-b-2 border-ink/10 py-2 last:border-b-0 ${prize.active ? "" : "opacity-50"}`}>
      {editing ? (
        <div className="flex flex-wrap items-center gap-2">
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="Emoji"
            className="w-12 rounded-xl border-2 border-ink bg-cream px-2 py-1.5 text-center text-sm font-bold outline-none" />
          <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} aria-label="Title"
            className="w-0 min-w-32 flex-1 rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none" />
          <label className="flex items-center gap-1 text-xs font-bold">
            weight
            <input type="number" min={1} max={100} value={weight} aria-label="Weight"
              onChange={(e) => setWeight(Number(e.target.value) || 1)}
              className="w-14 rounded-xl border-2 border-ink bg-cream px-2 py-1.5 text-sm font-bold outline-none" />
          </label>
          <button
            onClick={() => {
              setEditing(false);
              onSave({ title, emoji, weight });
            }}
            className="pressable rounded-xl border-2 border-ink bg-broccoli px-2.5 py-1.5 text-xs font-bold text-white"
          >
            Save
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between text-sm font-bold">
          <span>
            {prize.emoji} {prize.title}{" "}
            <span className="text-xs text-ink-soft">· weight {prize.weight}</span>
          </span>
          <span className="flex gap-2 text-xs">
            <button onClick={() => setEditing(true)} className="text-blueberry underline">Edit</button>
            <button onClick={() => onSave({ active: !prize.active })} className="text-ink-soft underline">
              {prize.active ? "Disable" : "Enable"}
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

function NewPrizeForm({
  onCreate,
}: {
  onCreate: (prize: { title: string; emoji: string; weight: number }) => void;
}) {
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState("🎁");
  return (
    <div className="flex items-center gap-2 pt-3">
      <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} aria-label="New prize emoji"
        className="w-12 rounded-xl border-2 border-ink bg-cream px-2 py-1.5 text-center text-sm font-bold outline-none" />
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="New prize…" maxLength={80} aria-label="New prize title"
        className="w-0 flex-1 rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none" />
      <button
        disabled={title.trim().length === 0}
        onClick={() => {
          onCreate({ title: title.trim(), emoji, weight: 1 });
          setTitle("");
        }}
        className="pressable rounded-xl border-2 border-ink bg-custard px-3 py-1.5 font-display text-xs disabled:opacity-40"
      >
        Add
      </button>
    </div>
  );
}

function FoodList({
  foods,
  artworkAvailable,
  onToggle,
  onRegenerate,
}: {
  foods: Props["foods"];
  artworkAvailable: boolean;
  onToggle: (food: Props["foods"][number]) => void;
  onRegenerate: (food: Props["foods"][number]) => void;
}) {
  const [query, setQuery] = useState("");
  const visible = foods.filter((f) =>
    f.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search foods…"
        aria-label="Search foods"
        className="mb-2 w-full rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none"
      />
      <div className="max-h-72 overflow-y-auto">
        {visible.map((f) => (
          <div
            key={f.id}
            className={`flex items-center justify-between border-b-2 border-ink/10 py-1.5 text-sm font-bold last:border-b-0 ${f.active ? "" : "opacity-50"}`}
          >
            <span>
              {f.emoji} {f.name}
              <span className="pl-1 text-[10px] text-ink-soft">
                {f.source === "custom" ? "· custom" : ""}
                {f.iconStatus === "ready" ? " · 🎨" : f.iconStatus === "failed" ? " · art failed" : ""}
              </span>
            </span>
            <span className="flex gap-2 text-xs">
              {artworkAvailable && f.iconStatus !== "generating" ? (
                <button onClick={() => onRegenerate(f)} className="text-blueberry underline">
                  {f.iconStatus === "ready" ? "Redraw" : "Draw art"}
                </button>
              ) : null}
              <button onClick={() => onToggle(f)} className="text-ink-soft underline">
                {f.active ? "Disable" : "Enable"}
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function GameSettings({
  household,
  onSave,
}: {
  household: Props["household"];
  onSave: (changes: { name?: string; timezone?: string; weeklyFamilyTarget?: number }) => void;
}) {
  const [name, setName] = useState(household.name);
  const [timezone, setTimezone] = useState(household.timezone);
  const [target, setTarget] = useState(household.weeklyFamilyTarget);
  const dirty =
    name !== household.name ||
    timezone !== household.timezone ||
    target !== household.weeklyFamilyTarget;
  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold">
        Family name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60}
          className="mt-0.5 w-full rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none" />
      </label>
      <label className="text-xs font-bold">
        Timezone
        <input value={timezone} onChange={(e) => setTimezone(e.target.value)} maxLength={60}
          className="mt-0.5 w-full rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none" />
      </label>
      <label className="text-xs font-bold">
        Weekly family target (portions)
        <input type="number" min={1} max={1000} value={target}
          onChange={(e) => setTarget(Number(e.target.value) || 140)}
          className="mt-0.5 w-full rounded-xl border-2 border-ink bg-cream px-3 py-1.5 text-sm font-bold outline-none" />
      </label>
      {dirty ? (
        <button
          onClick={() => onSave({ name, timezone, weeklyFamilyTarget: target })}
          className="pressable self-start rounded-xl border-2 border-ink bg-broccoli px-3 py-1.5 text-xs font-bold text-white"
        >
          Save settings
        </button>
      ) : null}
    </div>
  );
}
