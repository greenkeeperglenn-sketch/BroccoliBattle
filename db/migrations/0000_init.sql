CREATE TABLE "challenge_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"emoji" text NOT NULL,
	"metric" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"food_id" uuid NOT NULL,
	"alias_normalized" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"food_id" uuid NOT NULL,
	"client_event_id" text NOT NULL,
	"portion_size" text NOT NULL,
	"portion_units" double precision NOT NULL,
	"category_snapshot" text NOT NULL,
	"food_name_snapshot" text NOT NULL,
	"consumed_at" timestamp with time zone NOT NULL,
	"consumed_local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "food_entries_portion_units_positive" CHECK ("food_entries"."portion_units" > 0)
);
--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category" text NOT NULL,
	"emoji" text DEFAULT '🥦' NOT NULL,
	"personality" text,
	"qualifies_for_daily_target" boolean DEFAULT true NOT NULL,
	"daily_contribution_cap" double precision,
	"source" text DEFAULT 'seed' NOT NULL,
	"created_by_member_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"icon_url" text,
	"icon_status" text DEFAULT 'placeholder' NOT NULL,
	"icon_prompt" text,
	"icon_provider" text,
	"icon_model" text,
	"icon_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'Europe/London' NOT NULL,
	"weekly_family_target" double precision DEFAULT 140 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "management_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "management_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_invites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "member_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"session_token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"avatar_style" text DEFAULT 'broccoli' NOT NULL,
	"avatar_url" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prize_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"emoji" text DEFAULT '🎁' NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "prize_definitions_weight_positive" CHECK ("prize_definitions"."weight" > 0)
);
--> statement-breakpoint
CREATE TABLE "prize_spins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_battle_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"prize_definition_id" uuid NOT NULL,
	"prize_snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prize_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"weekly_battle_id" uuid NOT NULL,
	"prize_spin_id" uuid NOT NULL,
	"title_snapshot" text NOT NULL,
	"description_snapshot" text,
	"emoji_snapshot" text NOT NULL,
	"won_for_snapshot" text NOT NULL,
	"status" text DEFAULT 'unused' NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cashed_in_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"household_id" uuid NOT NULL,
	"week_start_local" date NOT NULL,
	"week_end_local" date NOT NULL,
	"challenge_definition_id" uuid NOT NULL,
	"challenge_snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"report" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "weekly_member_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"weekly_battle_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"score" double precision NOT NULL,
	"rank" integer NOT NULL,
	"winner" boolean DEFAULT false NOT NULL,
	"result_detail" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_aliases" ADD CONSTRAINT "food_aliases_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_food_id_foods_id_fk" FOREIGN KEY ("food_id") REFERENCES "public"."foods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_created_by_member_id_members_id_fk" FOREIGN KEY ("created_by_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_invites" ADD CONSTRAINT "management_invites_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "management_sessions" ADD CONSTRAINT "management_sessions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_invites" ADD CONSTRAINT "member_invites_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_sessions" ADD CONSTRAINT "member_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_definitions" ADD CONSTRAINT "prize_definitions_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_spins" ADD CONSTRAINT "prize_spins_weekly_battle_id_weekly_battles_id_fk" FOREIGN KEY ("weekly_battle_id") REFERENCES "public"."weekly_battles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_spins" ADD CONSTRAINT "prize_spins_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_spins" ADD CONSTRAINT "prize_spins_prize_definition_id_prize_definitions_id_fk" FOREIGN KEY ("prize_definition_id") REFERENCES "public"."prize_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_tickets" ADD CONSTRAINT "prize_tickets_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_tickets" ADD CONSTRAINT "prize_tickets_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_tickets" ADD CONSTRAINT "prize_tickets_weekly_battle_id_weekly_battles_id_fk" FOREIGN KEY ("weekly_battle_id") REFERENCES "public"."weekly_battles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prize_tickets" ADD CONSTRAINT "prize_tickets_prize_spin_id_prize_spins_id_fk" FOREIGN KEY ("prize_spin_id") REFERENCES "public"."prize_spins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_battles" ADD CONSTRAINT "weekly_battles_household_id_households_id_fk" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_battles" ADD CONSTRAINT "weekly_battles_challenge_definition_id_challenge_definitions_id_fk" FOREIGN KEY ("challenge_definition_id") REFERENCES "public"."challenge_definitions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_member_results" ADD CONSTRAINT "weekly_member_results_weekly_battle_id_weekly_battles_id_fk" FOREIGN KEY ("weekly_battle_id") REFERENCES "public"."weekly_battles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_member_results" ADD CONSTRAINT "weekly_member_results_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "challenge_definitions_code_idx" ON "challenge_definitions" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "food_aliases_alias_idx" ON "food_aliases" USING btree ("alias_normalized");--> statement-breakpoint
CREATE UNIQUE INDEX "food_entries_client_event_idx" ON "food_entries" USING btree ("household_id","client_event_id");--> statement-breakpoint
CREATE INDEX "food_entries_member_date_idx" ON "food_entries" USING btree ("member_id","consumed_local_date");--> statement-breakpoint
CREATE INDEX "food_entries_household_date_idx" ON "food_entries" USING btree ("household_id","consumed_local_date");--> statement-breakpoint
CREATE UNIQUE INDEX "foods_slug_idx" ON "foods" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "management_invites_token_hash_idx" ON "management_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "management_sessions_token_hash_idx" ON "management_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "member_invites_token_hash_idx" ON "member_invites" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "member_sessions_token_hash_idx" ON "member_sessions" USING btree ("session_token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "prize_spins_battle_member_idx" ON "prize_spins" USING btree ("weekly_battle_id","member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "prize_tickets_spin_idx" ON "prize_tickets" USING btree ("prize_spin_id");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_battles_household_week_idx" ON "weekly_battles" USING btree ("household_id","week_start_local");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_member_results_battle_member_idx" ON "weekly_member_results" USING btree ("weekly_battle_id","member_id");