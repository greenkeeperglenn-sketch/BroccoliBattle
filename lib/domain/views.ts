import { and, asc, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import {
  foodEntries,
  foods,
  members,
  prizeSpins,
  prizeTickets,
  weeklyBattles,
  weeklyMemberResults,
  type Food,
  type Household,
  type Member,
  type PrizeTicket,
  type WeeklyBattle,
} from "@/lib/db/schema";
import {
  computeStandings,
  ensureCurrentWeek,
  getClosedBattles,
  getWeekEntries,
  type Standing,
} from "./battles";
import { getSpinEntitlements } from "./prizes";
import {
  addDays,
  localDateOf,
  monthStartOf,
  weekDates,
  weekStartOf,
  type LocalDate,
} from "./dates";
import { dailyTotals, isPerfectWeek, totalPortions } from "./scoring";
import {
  computeMemberStats,
  computeTitleHolders,
  earnedAchievements,
  type MemberStats,
  type StatsEntry,
} from "./stats";

/**
 * Read-model assembly for the app's screens. Each function performs the
 * queries for one screen and delegates the maths to the pure domain
 * modules. All return values are JSON-serialisable.
 */

export type Ctx = { member: Member; household: Household };

async function getActiveMembers(db: Db, householdId: string): Promise<Member[]> {
  return db
    .select()
    .from(members)
    .where(and(eq(members.householdId, householdId), eq(members.active, true)))
    .orderBy(asc(members.createdAt));
}

// ─── Battle home ────────────────────────────────────────────────────────────

export type TodayEntry = {
  id: string;
  foodName: string;
  emoji: string;
  iconUrl: string | null;
  portionSize: "small" | "fist" | "monster";
  portionUnits: number;
  category: "fruit" | "veg";
  clientEventId: string;
};

export type DashboardData = {
  member: { id: string; displayName: string; avatarStyle: string };
  household: { name: string; timezone: string; weeklyFamilyTarget: number };
  today: {
    date: LocalDate;
    total: number;
    entries: TodayEntry[];
  };
  battle: {
    id: string;
    name: string;
    emoji: string;
    description: string;
    metric: string;
    weekStart: LocalDate;
    standings: {
      memberId: string;
      name: string;
      avatarStyle: string;
      score: number;
      rank: number;
      isYou: boolean;
    }[];
  };
  family: { total: number; target: number };
  pendingSpins: {
    battleId: string;
    battleName: string;
    battleEmoji: string;
    weekStart: LocalDate;
  }[];
  lastResult: LastResult | null;
};

export type LastResult = {
  battleId: string;
  name: string;
  emoji: string;
  weekStart: LocalDate;
  report: string | null;
  winners: { name: string; avatarStyle: string; score: number }[];
  metric: string;
  youWon: boolean;
};

export async function getDashboard(db: Db, ctx: Ctx): Promise<DashboardData> {
  const battle = await ensureCurrentWeek(db, ctx.household);
  const today = localDateOf(new Date(), ctx.household.timezone);
  const activeMembers = await getActiveMembers(db, ctx.household.id);

  const weekEntries = await getWeekEntries(
    db,
    ctx.household.id,
    battle.weekStartLocal,
  );
  const standings = computeStandings(battle, activeMembers, weekEntries);

  const todayRows = await db
    .select({ entry: foodEntries, food: foods })
    .from(foodEntries)
    .innerJoin(foods, eq(foodEntries.foodId, foods.id))
    .where(
      and(
        eq(foodEntries.memberId, ctx.member.id),
        eq(foodEntries.consumedLocalDate, today),
        isNull(foodEntries.deletedAt),
      ),
    )
    .orderBy(desc(foodEntries.createdAt));

  const todayTotal =
    Math.round(
      todayRows.reduce((sum, r) => sum + r.entry.portionUnits, 0) * 10,
    ) / 10;

  const entitlements = await getSpinEntitlements(db, ctx.member.id);
  const pendingSpins = entitlements
    .filter((e) => !e.spun)
    .map((e) => ({
      battleId: e.battle.id,
      battleName: e.battle.challengeSnapshot.name,
      battleEmoji: e.battle.challengeSnapshot.emoji,
      weekStart: e.battle.weekStartLocal,
    }));

  const lastResult = await getLastResult(db, ctx);

  return {
    member: {
      id: ctx.member.id,
      displayName: ctx.member.displayName,
      avatarStyle: ctx.member.avatarStyle,
    },
    household: {
      name: ctx.household.name,
      timezone: ctx.household.timezone,
      weeklyFamilyTarget: ctx.household.weeklyFamilyTarget,
    },
    today: {
      date: today,
      total: todayTotal,
      entries: todayRows.map((r) => ({
        id: r.entry.id,
        foodName: r.entry.foodNameSnapshot,
        emoji: r.food.emoji,
        iconUrl: r.food.iconStatus === "ready" ? r.food.iconUrl : null,
        portionSize: r.entry.portionSize,
        portionUnits: r.entry.portionUnits,
        category: r.entry.categorySnapshot,
        clientEventId: r.entry.clientEventId,
      })),
    },
    battle: {
      id: battle.id,
      name: battle.challengeSnapshot.name,
      emoji: battle.challengeSnapshot.emoji,
      description: battle.challengeSnapshot.description,
      metric: battle.challengeSnapshot.metric,
      weekStart: battle.weekStartLocal,
      standings: standings.map((s) => ({
        memberId: s.member.id,
        name: s.member.displayName,
        avatarStyle: s.member.avatarStyle,
        score: s.score,
        rank: s.rank,
        isYou: s.member.id === ctx.member.id,
      })),
    },
    family: {
      total: totalPortions(weekEntries),
      target: ctx.household.weeklyFamilyTarget,
    },
    pendingSpins,
    lastResult,
  };
}

/** The most recently closed battle, for the result reveal. */
export async function getLastResult(
  db: Db,
  ctx: Ctx,
): Promise<LastResult | null> {
  const [battle] = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.householdId, ctx.household.id),
        eq(weeklyBattles.status, "closed"),
      ),
    )
    .orderBy(desc(weeklyBattles.weekStartLocal))
    .limit(1);
  if (!battle) return null;

  const results = await db
    .select({ result: weeklyMemberResults, member: members })
    .from(weeklyMemberResults)
    .innerJoin(members, eq(weeklyMemberResults.memberId, members.id))
    .where(eq(weeklyMemberResults.weeklyBattleId, battle.id))
    .orderBy(asc(weeklyMemberResults.rank));

  const winners = results.filter((r) => r.result.winner);
  return {
    battleId: battle.id,
    name: battle.challengeSnapshot.name,
    emoji: battle.challengeSnapshot.emoji,
    weekStart: battle.weekStartLocal,
    report: battle.report,
    metric: battle.challengeSnapshot.metric,
    winners: winners.map((w) => ({
      name: w.member.displayName,
      avatarStyle: w.member.avatarStyle,
      score: w.result.score,
    })),
    youWon: winners.some((w) => w.member.id === ctx.member.id),
  };
}

// ─── Foods for the logger ───────────────────────────────────────────────────

export type LoggerFood = {
  id: string;
  name: string;
  category: "fruit" | "veg";
  emoji: string;
  iconUrl: string | null;
  recent: boolean;
  frequency: number;
};

/** Active foods ordered: recent favourites, then frequent, then A–Z. */
export async function getLoggerFoods(db: Db, ctx: Ctx): Promise<LoggerFood[]> {
  const allFoods = await db
    .select()
    .from(foods)
    .where(eq(foods.active, true));

  const twoWeeksAgo = addDays(
    localDateOf(new Date(), ctx.household.timezone),
    -14,
  );
  const history = await db
    .select({
      foodId: foodEntries.foodId,
      consumedLocalDate: foodEntries.consumedLocalDate,
    })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.memberId, ctx.member.id),
        isNull(foodEntries.deletedAt),
      ),
    );

  const frequency = new Map<string, number>();
  const recent = new Set<string>();
  for (const h of history) {
    frequency.set(h.foodId, (frequency.get(h.foodId) ?? 0) + 1);
    if (h.consumedLocalDate >= twoWeeksAgo) recent.add(h.foodId);
  }

  const visible = allFoods.filter(
    (f) => f.householdId === null || f.householdId === ctx.household.id,
  );

  return visible
    .map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      emoji: f.emoji,
      iconUrl: f.iconStatus === "ready" ? f.iconUrl : null,
      recent: recent.has(f.id),
      frequency: frequency.get(f.id) ?? 0,
    }))
    .sort((a, b) => {
      if (a.recent !== b.recent) return a.recent ? -1 : 1;
      if (a.frequency !== b.frequency) return b.frequency - a.frequency;
      return a.name.localeCompare(b.name);
    });
}

// ─── League ─────────────────────────────────────────────────────────────────

export type LeaguePeriod = "week" | "month" | "all";

export type LeagueData = {
  period: LeaguePeriod;
  members: {
    id: string;
    name: string;
    avatarStyle: string;
    isYou: boolean;
    stats: MemberStats;
    achievements: { code: string; name: string; emoji: string; description: string }[];
  }[];
  titles: {
    code: string;
    name: string;
    emoji: string;
    unit: string;
    value: number;
    holders: string[]; // display names
  }[];
};

export async function getLeague(
  db: Db,
  ctx: Ctx,
  period: LeaguePeriod,
): Promise<LeagueData> {
  const today = localDateOf(new Date(), ctx.household.timezone);
  const activeMembers = await getActiveMembers(db, ctx.household.id);

  let from: LocalDate;
  if (period === "week") from = weekStartOf(today);
  else if (period === "month") from = monthStartOf(today);
  else from = "1970-01-01";

  const rows = await db
    .select({
      memberId: foodEntries.memberId,
      foodId: foodEntries.foodId,
      categorySnapshot: foodEntries.categorySnapshot,
      portionUnits: foodEntries.portionUnits,
      consumedLocalDate: foodEntries.consumedLocalDate,
      portionSize: foodEntries.portionSize,
    })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.householdId, ctx.household.id),
        gte(foodEntries.consumedLocalDate, from),
        lte(foodEntries.consumedLocalDate, today),
        isNull(foodEntries.deletedAt),
      ),
    );

  // Ordered dates in range for streak/day counting.
  const first =
    period === "all"
      ? rows.reduce<LocalDate>(
          (min, r) => (r.consumedLocalDate < min ? r.consumedLocalDate : min),
          today,
        )
      : from;
  const dates: LocalDate[] = [];
  for (let d = first; d <= today; d = addDays(d, 1)) dates.push(d);

  // Battle wins / tickets / perfect weeks within the period.
  const closed = await getClosedBattles(db, ctx.household.id, 500);
  const inPeriod = closed.filter((c) => c.battle.weekStartLocal >= from);
  const wins = new Map<string, number>();
  for (const c of inPeriod) {
    for (const r of c.results) {
      if (r.winner) wins.set(r.memberId, (wins.get(r.memberId) ?? 0) + 1);
    }
  }
  const tickets = await db
    .select()
    .from(prizeTickets)
    .where(eq(prizeTickets.householdId, ctx.household.id));
  const ticketCounts = new Map<string, number>();
  for (const t of tickets) {
    ticketCounts.set(t.memberId, (ticketCounts.get(t.memberId) ?? 0) + 1);
  }

  // Perfect weeks: judged over closed weeks in period, from stored entries.
  const perfect = new Map<string, number>();
  for (const c of inPeriod) {
    const wk = weekDates(c.battle.weekStartLocal);
    const weekRows = rows.filter(
      (r) => r.consumedLocalDate >= wk[0] && r.consumedLocalDate <= wk[6],
    );
    for (const m of activeMembers) {
      if (isPerfectWeek(weekRows.filter((r) => r.memberId === m.id), wk)) {
        perfect.set(m.id, (perfect.get(m.id) ?? 0) + 1);
      }
    }
  }

  const statsByMember = activeMembers.map((m) => {
    const entries: StatsEntry[] = rows.filter((r) => r.memberId === m.id);
    return computeMemberStats({
      memberId: m.id,
      entries,
      dates,
      battleWins: wins.get(m.id) ?? 0,
      ticketsWon: ticketCounts.get(m.id) ?? 0,
      perfectWeeks: perfect.get(m.id) ?? 0,
    });
  });

  const titleHolders = computeTitleHolders(statsByMember);
  const nameOf = new Map(activeMembers.map((m) => [m.id, m.displayName]));

  return {
    period,
    members: activeMembers.map((m, i) => ({
      id: m.id,
      name: m.displayName,
      avatarStyle: m.avatarStyle,
      isYou: m.id === ctx.member.id,
      stats: statsByMember[i],
      achievements: earnedAchievements(statsByMember[i]).map((a) => ({
        code: a.code,
        name: a.name,
        emoji: a.emoji,
        description: a.description,
      })),
    })),
    titles: titleHolders.map((t) => ({
      code: t.title.code,
      name: t.title.name,
      emoji: t.title.emoji,
      unit: t.title.unit,
      value: t.value,
      holders: t.memberIds.map((id) => nameOf.get(id) ?? "?"),
    })),
  };
}

// ─── Hall of Glory ──────────────────────────────────────────────────────────

export type GloryWeek = {
  battleId: string;
  weekStart: LocalDate;
  name: string;
  emoji: string;
  report: string | null;
  winners: { name: string; avatarStyle: string; score: number }[];
  metric: string;
  prizes: { winner: string; title: string; emoji: string }[];
};

export type GloryData = {
  weeks: GloryWeek[];
  lifetime: {
    mostCrowns: { name: string; count: number }[];
    mostSpins: { name: string; count: number }[];
  };
};

export async function getHallOfGlory(db: Db, ctx: Ctx): Promise<GloryData> {
  const closed = await getClosedBattles(db, ctx.household.id, 200);
  const activeMembers = await getActiveMembers(db, ctx.household.id);
  const nameOf = new Map(activeMembers.map((m) => [m.id, m.displayName]));

  const battleIds = closed.map((c) => c.battle.id);
  const tickets = battleIds.length
    ? await db
        .select()
        .from(prizeTickets)
        .where(inArray(prizeTickets.weeklyBattleId, battleIds))
    : [];

  const crowns = new Map<string, number>();
  const spins = new Map<string, number>();
  for (const c of closed) {
    for (const r of c.results) {
      if (r.winner) crowns.set(r.memberId, (crowns.get(r.memberId) ?? 0) + 1);
    }
  }
  for (const t of tickets) {
    spins.set(t.memberId, (spins.get(t.memberId) ?? 0) + 1);
  }

  const rankCounts = (m: Map<string, number>) =>
    [...m.entries()]
      .map(([id, count]) => ({ name: nameOf.get(id) ?? "?", count }))
      .sort((a, b) => b.count - a.count);

  return {
    weeks: closed.map((c) => ({
      battleId: c.battle.id,
      weekStart: c.battle.weekStartLocal,
      name: c.battle.challengeSnapshot.name,
      emoji: c.battle.challengeSnapshot.emoji,
      report: c.battle.report,
      metric: c.battle.challengeSnapshot.metric,
      winners: c.results
        .filter((r) => r.winner)
        .map((r) => ({
          name: r.member.displayName,
          avatarStyle: r.member.avatarStyle,
          score: r.score,
        })),
      prizes: tickets
        .filter((t) => t.weeklyBattleId === c.battle.id)
        .map((t) => ({
          winner: nameOf.get(t.memberId) ?? "?",
          title: t.titleSnapshot,
          emoji: t.emojiSnapshot,
        })),
    })),
    lifetime: {
      mostCrowns: rankCounts(crowns),
      mostSpins: rankCounts(spins),
    },
  };
}

// ─── Prizes / wallet ────────────────────────────────────────────────────────

export type WalletTicket = {
  id: string;
  title: string;
  description: string | null;
  emoji: string;
  wonFor: string;
  weekStart: LocalDate;
  status: "unused" | "cashed_in";
  cashedInAt: string | null;
};

export type WalletData = {
  wallets: {
    memberId: string;
    name: string;
    avatarStyle: string;
    isYou: boolean;
    unused: WalletTicket[];
    used: WalletTicket[];
  }[];
  pendingSpins: DashboardData["pendingSpins"];
};

export async function getWallets(db: Db, ctx: Ctx): Promise<WalletData> {
  const activeMembers = await getActiveMembers(db, ctx.household.id);
  const tickets = await db
    .select({ ticket: prizeTickets, battle: weeklyBattles })
    .from(prizeTickets)
    .innerJoin(
      weeklyBattles,
      eq(prizeTickets.weeklyBattleId, weeklyBattles.id),
    )
    .where(eq(prizeTickets.householdId, ctx.household.id))
    .orderBy(desc(prizeTickets.issuedAt));

  const toWallet = (t: (typeof tickets)[number]): WalletTicket => ({
    id: t.ticket.id,
    title: t.ticket.titleSnapshot,
    description: t.ticket.descriptionSnapshot,
    emoji: t.ticket.emojiSnapshot,
    wonFor: t.ticket.wonForSnapshot,
    weekStart: t.battle.weekStartLocal,
    status: t.ticket.status,
    cashedInAt: t.ticket.cashedInAt?.toISOString() ?? null,
  });

  const entitlements = await getSpinEntitlements(db, ctx.member.id);

  return {
    wallets: activeMembers.map((m) => ({
      memberId: m.id,
      name: m.displayName,
      avatarStyle: m.avatarStyle,
      isYou: m.id === ctx.member.id,
      unused: tickets
        .filter((t) => t.ticket.memberId === m.id && t.ticket.status === "unused")
        .map(toWallet),
      used: tickets
        .filter((t) => t.ticket.memberId === m.id && t.ticket.status === "cashed_in")
        .map(toWallet),
    })),
    pendingSpins: entitlements
      .filter((e) => !e.spun)
      .map((e) => ({
        battleId: e.battle.id,
        battleName: e.battle.challengeSnapshot.name,
        battleEmoji: e.battle.challengeSnapshot.emoji,
        weekStart: e.battle.weekStartLocal,
      })),
  };
}

// ─── Collection ─────────────────────────────────────────────────────────────

export type CollectionCard = {
  id: string;
  name: string;
  category: "fruit" | "veg";
  emoji: string;
  iconUrl: string | null;
  personality: string | null;
  discovered: boolean;
  discoveredOn: LocalDate | null;
  familyTimes: number;
  yourPortions: number;
  champion: string | null;
};

export async function getCollection(db: Db, ctx: Ctx): Promise<CollectionCard[]> {
  const allFoods = await db
    .select()
    .from(foods)
    .where(eq(foods.active, true))
    .orderBy(asc(foods.name));
  const visible = allFoods.filter(
    (f) => f.householdId === null || f.householdId === ctx.household.id,
  );

  const rows = await db
    .select({
      foodId: foodEntries.foodId,
      memberId: foodEntries.memberId,
      portionUnits: foodEntries.portionUnits,
      consumedLocalDate: foodEntries.consumedLocalDate,
    })
    .from(foodEntries)
    .where(
      and(
        eq(foodEntries.householdId, ctx.household.id),
        isNull(foodEntries.deletedAt),
      ),
    );

  const activeMembers = await getActiveMembers(db, ctx.household.id);
  const nameOf = new Map(activeMembers.map((m) => [m.id, m.displayName]));

  return visible.map((f) => {
    const entries = rows.filter((r) => r.foodId === f.id);
    const perMember = new Map<string, number>();
    let discoveredOn: LocalDate | null = null;
    let yourPortions = 0;
    for (const e of entries) {
      perMember.set(e.memberId, (perMember.get(e.memberId) ?? 0) + e.portionUnits);
      if (!discoveredOn || e.consumedLocalDate < discoveredOn) {
        discoveredOn = e.consumedLocalDate;
      }
      if (e.memberId === ctx.member.id) yourPortions += e.portionUnits;
    }
    let champion: string | null = null;
    let best = 0;
    for (const [memberId, units] of perMember) {
      if (units > best) {
        best = units;
        champion = nameOf.get(memberId) ?? null;
      }
    }
    return {
      id: f.id,
      name: f.name,
      category: f.category,
      emoji: f.emoji,
      iconUrl: f.iconStatus === "ready" ? f.iconUrl : null,
      personality: f.personality,
      discovered: entries.length > 0,
      discoveredOn,
      familyTimes: entries.length,
      yourPortions: Math.round(yourPortions * 10) / 10,
      champion,
    };
  });
}

// ─── Battle result (winner reveal) ──────────────────────────────────────────

export type ResultView = {
  battleId: string;
  name: string;
  emoji: string;
  description: string;
  metric: string;
  weekStart: LocalDate;
  report: string | null;
  standings: {
    name: string;
    avatarStyle: string;
    score: number;
    rank: number;
    winner: boolean;
    isYou: boolean;
  }[];
  youWon: boolean;
  yourSpinUsed: boolean;
  ticket: WalletTicket | null;
};

export async function getBattleResult(
  db: Db,
  ctx: Ctx,
  battleId: string,
): Promise<ResultView | null> {
  const [battle] = await db
    .select()
    .from(weeklyBattles)
    .where(
      and(
        eq(weeklyBattles.id, battleId),
        eq(weeklyBattles.householdId, ctx.household.id),
        eq(weeklyBattles.status, "closed"),
      ),
    );
  if (!battle) return null;

  const results = await db
    .select({ result: weeklyMemberResults, member: members })
    .from(weeklyMemberResults)
    .innerJoin(members, eq(weeklyMemberResults.memberId, members.id))
    .where(eq(weeklyMemberResults.weeklyBattleId, battle.id))
    .orderBy(asc(weeklyMemberResults.rank));

  const [spin] = await db
    .select()
    .from(prizeSpins)
    .where(
      and(
        eq(prizeSpins.weeklyBattleId, battle.id),
        eq(prizeSpins.memberId, ctx.member.id),
      ),
    );

  let ticket: WalletTicket | null = null;
  if (spin) {
    const [t] = await db
      .select()
      .from(prizeTickets)
      .where(eq(prizeTickets.prizeSpinId, spin.id));
    if (t) {
      ticket = {
        id: t.id,
        title: t.titleSnapshot,
        description: t.descriptionSnapshot,
        emoji: t.emojiSnapshot,
        wonFor: t.wonForSnapshot,
        weekStart: battle.weekStartLocal,
        status: t.status,
        cashedInAt: t.cashedInAt?.toISOString() ?? null,
      };
    }
  }

  const youWon = results.some(
    (r) => r.result.winner && r.member.id === ctx.member.id,
  );

  return {
    battleId: battle.id,
    name: battle.challengeSnapshot.name,
    emoji: battle.challengeSnapshot.emoji,
    description: battle.challengeSnapshot.description,
    metric: battle.challengeSnapshot.metric,
    weekStart: battle.weekStartLocal,
    report: battle.report,
    standings: results.map((r) => ({
      name: r.member.displayName,
      avatarStyle: r.member.avatarStyle,
      score: r.result.score,
      rank: r.result.rank,
      winner: r.result.winner,
      isYou: r.member.id === ctx.member.id,
    })),
    youWon,
    yourSpinUsed: Boolean(spin),
    ticket,
  };
}

// ─── Family week progress (Battle Garden) ───────────────────────────────────

export function familyDailySeries(
  entries: { portionUnits: number; consumedLocalDate: LocalDate }[],
  weekStart: LocalDate,
): { date: LocalDate; total: number }[] {
  const totals = dailyTotals(
    entries.map((e) => ({
      memberId: "family",
      foodId: "any",
      categorySnapshot: "veg" as const,
      portionUnits: e.portionUnits,
      consumedLocalDate: e.consumedLocalDate,
    })),
  );
  return weekDates(weekStart).map((d) => ({
    date: d,
    total: totals.get(d) ?? 0,
  }));
}
