# Broccoli Battle — Architecture

A deliberately small system: one Next.js app, one database, no queues, no
microservices. Four people play it.

## Layers

```
app/            Next.js App Router — pages (RSC) + API route handlers
components/     UI — server components for display, client components for play
lib/domain/     Business rules (pure where possible, injected db elsewhere)
lib/db/         Drizzle schema, dual-driver client, seed data
lib/auth/       Token hashing, invite binding, device sessions
lib/ai/         OpenAI boundary: classification, artwork, weekly report
lib/blob/       Vercel Blob storage
lib/offline/    Client outbox for offline logging
db/migrations/  Generated SQL migrations (drizzle-kit)
scripts/        migrate, seed, seed-demo, generate-food-art, make-icons
```

Pages are server components that call `lib/domain/views.ts` (read-model
assembly) directly — no HTTP hop. Mutations go through JSON route handlers
under `app/api/*` because the offline outbox needs explicit endpoints.

## Database

Drizzle ORM against Postgres. `lib/db/client.ts` picks the driver from
`DATABASE_URL`:

- `postgres://…` → node-postgres pool (Neon in production),
- unset or `pglite://…` → embedded PGlite (migrations auto-applied), used
  for local dev, integration tests (in-memory) and E2E.

Both expose the same Drizzle API, so every domain function runs identically
against either. Key invariants live in the schema, not application luck:

- `(household, week_start)` unique — one battle per week, reconciliation
  races collapse into `onConflictDoNothing`,
- `(household, client_event_id)` unique — offline retries never double-count,
- `(battle, member)` unique on spins — a refresh can never spin twice,
- check constraints: positive portion units, positive prize weights.

## Session model (no logins)

Each member has a private invite URL `/bind/{token}`. Opening it:

1. hashes the token (SHA-256) and looks up an active invite,
2. creates a `member_sessions` row storing only the **hash** of a fresh
   256-bit session token,
3. sets the plaintext as an HTTP-only, SameSite=Lax, Secure cookie,
4. redirects to `/` so the secret leaves the visible URL.

From then on the device *is* that member. Invites can be reused to bind new
phones and revoked/rotated from management. Management access works the same
way (`/manage/bind/{token}` → `management_sessions`), scoped to the
household rather than a member. Nothing secret is ever stored in plaintext.

## Data flow for a log

1. Client generates a `clientEventId` (UUID), applies the optimistic update
   and POSTs `/api/entries`.
2. Server validates (Zod), snapshots food name/category and the portion
   units at time of logging, derives `consumed_local_date` from the
   household timezone, and inserts with `onConflictDoNothing`.
3. Response carries authoritative totals plus microcopy (deterministic pools
   seeded by the event id) and rank movement.
4. On network failure the event enters the localStorage outbox
   (`lib/offline/outbox.ts`) and is retried on `online`/interval via
   `/api/entries/batch` — idempotent by design.

## Weekly reconciliation

`ensureCurrentWeek(db, household)` runs on every dashboard/entry request:

1. computes the current local week (Monday-start, household timezone,
   DST-safe — see `lib/domain/dates.ts`),
2. closes any stale open battles in a transaction: snapshots per-member
   results (score, rank, winner, detail JSON), stores a templated battle
   report, marks the battle closed,
3. creates the current week's battle if missing, drawing a challenge
   **uniformly at random** (`crypto`-backed rng, injectable for tests) and
   persisting it immediately — refreshes can never re-roll.

A Vercel cron hits `/api/reconcile` Monday mornings as a convenience; the
app never depends on it.

## Scoring

`lib/domain/scoring.ts` is pure: portion units (0.5/1/1.5) are stored per
entry at log time, so later config changes never rewrite history. Challenge
metrics (veg/fruit/total portions, distinct foods, five-a-day days, streak)
are deterministic functions of a week's entries. Ranking is standard
competition ranking; winners are all rank-1 members with score > 0 (joint
champions allowed, zero-score weeks produce no champion).

## Prize determination

`spinPrizeWheel` runs in one transaction: verify the battle is closed, the
member is a winner, and no spin exists; draw a weighted prize server-side;
insert the spin **and** the snapshot ticket. The wheel animation on the
client merely reveals the persisted result. `cashInTicket` flips status
`unused → cashed_in` exactly once (guarded update); tickets are never
deleted, and management can repair an accidental cash-in.

## Ticket lifecycle

```
battle closed → winner entitled → spin (persisted) → ticket issued (snapshot)
     → sits in wallet (no expiry) → CASH IT IN → cashed_in (kept forever)
```

Tickets snapshot title/description/emoji/battle at issue time; editing prize
definitions later never rewrites history.

## AI artwork pipeline (Level 2)

`generateFoodArtwork`: build a controlled prompt (shared art direction + the
food's one-line personality) → OpenAI image API → store PNG in Vercel Blob
as an immutable versioned file (`slug-vN.png`) → save URL + prompt/model
metadata on the food. Status machine `placeholder → generating → ready |
failed` prevents duplicate spend; failure never blocks logging (emoji
placeholder remains). The seed script generates one image at a time and is
restartable.

## Testing

- **Unit** (Vitest): dates/DST, scoring, ranking/ties, weighted randomness
  with injected RNGs, templated reports, food normalisation/classification.
- **Integration** (Vitest + in-memory PGlite): invite binding, idempotent
  entries, battle lifecycle and snapshots, spin entitlements, ticket
  lifecycle, catalogue dedupe.
- **E2E** (Playwright, 390×844): bind → log → leaderboard → spin → ticket →
  cash-in, custom foods, collection, PWA manifest, management access.
