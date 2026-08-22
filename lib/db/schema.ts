import { sql } from "drizzle-orm";
import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  doublePrecision,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";

// ─── Household & people ─────────────────────────────────────────────────────

export const households = pgTable("households", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  timezone: text("timezone").notNull().default("Europe/London"),
  weeklyFamilyTarget: doublePrecision("weekly_family_target")
    .notNull()
    .default(140),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const members = pgTable("members", {
  id: uuid("id").primaryKey().defaultRandom(),
  householdId: uuid("household_id")
    .notNull()
    .references(() => households.id),
  displayName: text("display_name").notNull(),
  // One of the preset avatar colour styles, e.g. "broccoli", "tomato".
  avatarStyle: text("avatar_style").notNull().default("broccoli"),
  avatarUrl: text("avatar_url"),
  // A manager's ordinary member session also unlocks /manage — chosen at
  // setup so there is no separate admin link to lose.
  isManager: boolean("is_manager").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const memberInvites = pgTable(
  "member_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    tokenHash: text("token_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("member_invites_token_hash_idx").on(t.tokenHash)],
);

export const memberSessions = pgTable(
  "member_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    sessionTokenHash: text("session_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("member_sessions_token_hash_idx").on(t.sessionTokenHash)],
);

export const managementInvites = pgTable(
  "management_invites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    tokenHash: text("token_hash").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("management_invites_token_hash_idx").on(t.tokenHash)],
);

export const managementSessions = pgTable(
  "management_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    sessionTokenHash: text("session_token_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("management_sessions_token_hash_idx").on(t.sessionTokenHash),
  ],
);

// ─── Foods ──────────────────────────────────────────────────────────────────

export const foods = pgTable(
  "foods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Null household = global seed food available to every household.
    householdId: uuid("household_id").references(() => households.id),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category", { enum: ["fruit", "veg"] }).notNull(),
    emoji: text("emoji").notNull().default("🥦"),
    // A one-line personality used for artwork prompts and collection cards.
    personality: text("personality"),
    qualifiesForDailyTarget: boolean("qualifies_for_daily_target")
      .notNull()
      .default(true),
    dailyContributionCap: doublePrecision("daily_contribution_cap"),
    source: text("source", { enum: ["seed", "custom"] })
      .notNull()
      .default("seed"),
    createdByMemberId: uuid("created_by_member_id").references(
      () => members.id,
    ),
    active: boolean("active").notNull().default(true),
    iconUrl: text("icon_url"),
    iconStatus: text("icon_status", {
      enum: ["placeholder", "generating", "ready", "failed"],
    })
      .notNull()
      .default("placeholder"),
    iconPrompt: text("icon_prompt"),
    iconProvider: text("icon_provider"),
    iconModel: text("icon_model"),
    iconVersion: integer("icon_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("foods_slug_idx").on(t.slug)],
);

export const foodAliases = pgTable(
  "food_aliases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id),
    aliasNormalized: text("alias_normalized").notNull(),
  },
  (t) => [uniqueIndex("food_aliases_alias_idx").on(t.aliasNormalized)],
);

// ─── Food entries ───────────────────────────────────────────────────────────

export const foodEntries = pgTable(
  "food_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    foodId: uuid("food_id")
      .notNull()
      .references(() => foods.id),
    clientEventId: text("client_event_id").notNull(),
    portionSize: text("portion_size", {
      enum: ["small", "fist", "monster"],
    }).notNull(),
    portionUnits: doublePrecision("portion_units").notNull(),
    categorySnapshot: text("category_snapshot", {
      enum: ["fruit", "veg"],
    }).notNull(),
    foodNameSnapshot: text("food_name_snapshot").notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }).notNull(),
    consumedLocalDate: date("consumed_local_date").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // The same offline event synced twice must never double-count.
    uniqueIndex("food_entries_client_event_idx").on(
      t.householdId,
      t.clientEventId,
    ),
    index("food_entries_member_date_idx").on(t.memberId, t.consumedLocalDate),
    index("food_entries_household_date_idx").on(
      t.householdId,
      t.consumedLocalDate,
    ),
    check("food_entries_portion_units_positive", sql`${t.portionUnits} > 0`),
  ],
);

// ─── Weekly battles ─────────────────────────────────────────────────────────

export const challengeDefinitions = pgTable(
  "challenge_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    emoji: text("emoji").notNull(),
    metric: text("metric", {
      enum: [
        "veg_portions",
        "fruit_portions",
        "distinct_foods",
        "five_a_day_days",
        "total_portions",
        "five_a_day_streak",
      ],
    }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("challenge_definitions_code_idx").on(t.code)],
);

export type ChallengeSnapshot = {
  code: string;
  name: string;
  description: string;
  emoji: string;
  metric:
    | "veg_portions"
    | "fruit_portions"
    | "distinct_foods"
    | "five_a_day_days"
    | "total_portions"
    | "five_a_day_streak";
};

export const weeklyBattles = pgTable(
  "weekly_battles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    weekStartLocal: date("week_start_local").notNull(),
    weekEndLocal: date("week_end_local").notNull(),
    challengeDefinitionId: uuid("challenge_definition_id")
      .notNull()
      .references(() => challengeDefinitions.id),
    challengeSnapshot: jsonb("challenge_snapshot")
      .$type<ChallengeSnapshot>()
      .notNull(),
    status: text("status", { enum: ["open", "closed"] })
      .notNull()
      .default("open"),
    report: text("report"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    // Exactly one battle per household per week — reconciliation races are
    // resolved by the database, not by application luck.
    uniqueIndex("weekly_battles_household_week_idx").on(
      t.householdId,
      t.weekStartLocal,
    ),
  ],
);

export type ResultDetail = {
  vegPortions: number;
  fruitPortions: number;
  totalPortions: number;
  distinctFoods: number;
  fiveADayDays: number;
  longestStreak: number;
};

export const weeklyMemberResults = pgTable(
  "weekly_member_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weeklyBattleId: uuid("weekly_battle_id")
      .notNull()
      .references(() => weeklyBattles.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    score: doublePrecision("score").notNull(),
    rank: integer("rank").notNull(),
    winner: boolean("winner").notNull().default(false),
    resultDetail: jsonb("result_detail").$type<ResultDetail>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("weekly_member_results_battle_member_idx").on(
      t.weeklyBattleId,
      t.memberId,
    ),
  ],
);

// ─── Prizes ─────────────────────────────────────────────────────────────────

export const prizeDefinitions = pgTable(
  "prize_definitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    title: text("title").notNull(),
    description: text("description"),
    emoji: text("emoji").notNull().default("🎁"),
    weight: integer("weight").notNull().default(1),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("prize_definitions_weight_positive", sql`${t.weight} > 0`)],
);

export type PrizeSnapshot = {
  title: string;
  description: string | null;
  emoji: string;
  prizeDefinitionId: string;
};

export const prizeSpins = pgTable(
  "prize_spins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    weeklyBattleId: uuid("weekly_battle_id")
      .notNull()
      .references(() => weeklyBattles.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    prizeDefinitionId: uuid("prize_definition_id")
      .notNull()
      .references(() => prizeDefinitions.id),
    prizeSnapshot: jsonb("prize_snapshot").$type<PrizeSnapshot>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One spin per member per battle — a refresh can never spin twice.
    uniqueIndex("prize_spins_battle_member_idx").on(
      t.weeklyBattleId,
      t.memberId,
    ),
  ],
);

export const prizeTickets = pgTable(
  "prize_tickets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    householdId: uuid("household_id")
      .notNull()
      .references(() => households.id),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id),
    weeklyBattleId: uuid("weekly_battle_id")
      .notNull()
      .references(() => weeklyBattles.id),
    prizeSpinId: uuid("prize_spin_id")
      .notNull()
      .references(() => prizeSpins.id),
    titleSnapshot: text("title_snapshot").notNull(),
    descriptionSnapshot: text("description_snapshot"),
    emojiSnapshot: text("emoji_snapshot").notNull(),
    // The battle title the ticket was won under, e.g. "Veg King".
    wonForSnapshot: text("won_for_snapshot").notNull(),
    status: text("status", { enum: ["unused", "cashed_in"] })
      .notNull()
      .default("unused"),
    issuedAt: timestamp("issued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    cashedInAt: timestamp("cashed_in_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // One ticket per spin.
    uniqueIndex("prize_tickets_spin_idx").on(t.prizeSpinId),
  ],
);

// ─── Convenience row types ──────────────────────────────────────────────────

export type Household = typeof households.$inferSelect;
export type Member = typeof members.$inferSelect;
export type Food = typeof foods.$inferSelect;
export type FoodEntry = typeof foodEntries.$inferSelect;
export type ChallengeDefinition = typeof challengeDefinitions.$inferSelect;
export type WeeklyBattle = typeof weeklyBattles.$inferSelect;
export type WeeklyMemberResult = typeof weeklyMemberResults.$inferSelect;
export type PrizeDefinition = typeof prizeDefinitions.$inferSelect;
export type PrizeSpin = typeof prizeSpins.$inferSelect;
export type PrizeTicket = typeof prizeTickets.$inferSelect;
