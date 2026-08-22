"use client";

/**
 * Offline event queue. Every log gets a clientEventId; if the network is
 * down the event is stored in localStorage and retried when connectivity
 * returns. The server is idempotent on clientEventId, so retries can never
 * double-count.
 */

export type OutboxEvent = {
  clientEventId: string;
  foodId: string;
  portionSize: "small" | "fist" | "monster";
  consumedAt: string; // ISO — offline entries keep their original time
};

const KEY = "bb-outbox-v1";

function load(): OutboxEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxEvent[]) : [];
  } catch {
    return [];
  }
}

function save(events: OutboxEvent[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(events));
  } catch {
    // Storage full/blocked — nothing more we can do.
  }
}

export function outboxSize(): number {
  return load().length;
}

export function enqueue(event: OutboxEvent) {
  const events = load();
  if (!events.some((e) => e.clientEventId === event.clientEventId)) {
    events.push(event);
    save(events);
  }
}

export function removeFromOutbox(clientEventId: string): boolean {
  const events = load();
  const next = events.filter((e) => e.clientEventId !== clientEventId);
  save(next);
  return next.length !== events.length;
}

/** Push all queued events to the server. Returns how many were accepted. */
export async function flushOutbox(): Promise<number> {
  const events = load();
  if (events.length === 0) return 0;
  try {
    const res = await fetch("/api/entries/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events }),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as {
      ok: boolean;
      results: { clientEventId: string; status: string }[];
    };
    if (!data.ok) return 0;
    const done = new Set(
      data.results
        .filter((r) => r.status !== "failed")
        .map((r) => r.clientEventId),
    );
    save(load().filter((e) => !done.has(e.clientEventId)));
    return done.size;
  } catch {
    return 0; // still offline — try again later
  }
}

let listenerInstalled = false;

/** Install online/interval listeners that flush the outbox. */
export function installOutboxFlusher(onFlushed: () => void) {
  if (listenerInstalled) return;
  listenerInstalled = true;
  const tryFlush = async () => {
    if (outboxSize() > 0) {
      const n = await flushOutbox();
      if (n > 0) onFlushed();
    }
  };
  window.addEventListener("online", tryFlush);
  setInterval(tryFlush, 30_000);
  void tryFlush();
}
