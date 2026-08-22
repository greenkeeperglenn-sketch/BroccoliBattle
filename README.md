# 🥦 Broccoli Battle

**Fruit. Veg. Glory.**

A mobile-first PWA for one family of four. Eat fruit or veg, log it in
seconds, race to five-a-day, fight the weekly battle, win the crown, spin the
prize wheel, and cash your prize tickets in whenever you like. It is a game
that happens to produce healthier behaviour — never a health tracker.

## What's in the game

- **Three-second logging** — Fruit/Veg → tap the character → Small / Fist /
  Monster → done. Optimistic UI, undo, offline outbox with idempotent sync.
- **Daily five** — 0.5 / 1 / 1.5 portion units, a filling row of character
  slots, and a celebration at five.
- **Weekly battle** — one of six challenges (Veg King, Fruit Champion,
  Variety Victory, Five-a-Day Champion, Portion Powerhouse, Streak Champion)
  drawn **at random on the server** each Monday. Nobody picks. Repeats allowed.
- **Prize wheel** — the winner earns exactly one spin; the server draws a
  weighted prize and persists it *before* the wheel animation reveals it.
  Refreshing never re-spins.
- **Prize tickets** — spins issue snapshot tickets that live in the Prize
  Wallet until cashed in (they never expire and are never deleted).
- **League & Hall of Glory** — week/month/all-time stats, permanent titles,
  achievements, perfect weeks, and a growing family history.
- **Collection** — every food is a collectible character card; new foods
  trigger a NEW DISCOVERY celebration.
- **Family target** — the Battle Garden fills as the family works toward 140
  portions a week.

## Stack

Next.js (App Router) · TypeScript · React · Tailwind CSS 4 · Drizzle ORM ·
Neon Postgres (with an embedded **PGlite** fallback for local dev/tests) ·
Zod · Vercel Blob (artwork) · OpenAI (optional) · Vitest · Playwright · pnpm.

## Local setup

```bash
pnpm install
pnpm dev
```

That's it — with no `DATABASE_URL`, the app uses an embedded PGlite database
in `.data/pglite` (migrations run automatically). To play locally you need a
bootstrap token:

```bash
BOOTSTRAP_TOKEN=letmein pnpm dev
# open http://localhost:3000/setup and enter "letmein"
```

Or seed a full demo game (closed battle, pending prize spin, live week):

```bash
pnpm tsx scripts/seed-demo.ts        # prints the four invite links
DATABASE_URL=pglite://.data/demo pnpm dev
```

## Environment variables

See [`.env.example`](.env.example). Summary:

| Variable | Needed for | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Production | Neon/Postgres connection string; unset = local PGlite |
| `BOOTSTRAP_TOKEN` | First run | Guards the one-time `/setup` wizard |
| `APP_SECRET` | Recommended | General-purpose server secret |
| `BLOB_READ_WRITE_TOKEN` | Level 2 | Vercel Blob for character artwork |
| `OPENAI_API_KEY` | Levels 2–3 | Artwork + classification + weekly report |
| `OPENAI_IMAGE_MODEL` | Level 2 | Default `gpt-image-2` |
| `OPENAI_TEXT_MODEL` | Level 3 | Default `gpt-5-mini` |
| `CRON_SECRET` | Optional | Lets the Vercel cron call `/api/reconcile` |

The app runs at three capability levels — **core** (database only: the whole
game works, foods use emoji characters), **artwork** (Blob + image AI:
generated character art), and **AI personality** (text AI: smarter food
classification and AI-written weekly reports). Core never depends on AI.

## Neon setup

1. Create a project at [neon.tech](https://neon.tech); copy the connection
   string into `DATABASE_URL`.
2. `pnpm db:migrate` applies the SQL migrations in `db/migrations`.
3. `pnpm db:seed` inserts the global food catalogue and challenge
   definitions (also happens automatically during `/setup`).

## Vercel setup

1. Push this repo to GitHub and import it into Vercel — pushes deploy.
2. Set the environment variables above in the Vercel project.
3. `vercel.json` schedules `/api/reconcile` early every Monday. This is a
   convenience only: the app reconciles itself on every relevant request, so
   the game recovers even if no cron ever runs.

## Blob setup (optional, Level 2)

Create a Blob store in Vercel (Storage → Blob) and set
`BLOB_READ_WRITE_TOKEN`. Generated character images are stored as immutable
versioned files under `food-art/`.

## OpenAI setup (optional, Levels 2–3)

Set `OPENAI_API_KEY`. Without it: foods show emoji placeholders, food
classification falls back to a built-in dictionary + your own fruit/veg
choice, and weekly reports use a deterministic templated commentary system.

## First household setup

1. Deploy with `BOOTSTRAP_TOKEN` set (`openssl rand -hex 24`).
2. Open `https://your-app/setup`, enter the token, name the four family
   members and pick their colours.
3. Send each member their personal invite link (shown once, with copy
   buttons) — opening it binds their phone to their name forever. No logins.
4. Keep the management link somewhere safe — it unlocks `/manage`.

## Generating invite links again

`/manage` → Family → *Regenerate invite link* (revokes the old link and
shows a fresh one once). Existing bound phones keep working.

## Generating character art

```bash
pnpm generate:food-art          # draws every food without artwork
pnpm generate:food-art --retry  # also retries failures
```

One image at a time, restartable, never regenerates existing art, never runs
during build/deploy. Individual foods can also be drawn/redrawn from
`/manage` → Food catalogue.

## Running tests

```bash
pnpm test        # unit + integration (integration uses in-memory PGlite)
pnpm test:e2e    # Playwright mobile-viewport E2E against a seeded PGlite db
pnpm lint
pnpm typecheck
pnpm build
```

## Architecture overview

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for the session model, weekly
reconciliation, prize pipeline, offline queue and artwork pipeline, and
[`docs/GAME_RULES.md`](docs/GAME_RULES.md) for the game rules in plain
English.

## Known limitations

- Push notifications are not implemented (deliberately out of V1 scope).
- The Battle Garden is a stylised emoji scene, designed to evolve into a
  richer illustrated garden later.
- The weekly AI battle report is generated at battle close only when text AI
  is configured *at that moment*; otherwise the (also fun) templated report
  is stored permanently.
- One household per deployment — this is a private family game, not a
  multi-tenant platform.
