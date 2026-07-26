CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`at` text NOT NULL,
	`meta` text
);
--> statement-breakpoint
CREATE INDEX `audit_entity_idx` ON `audit_log` (`entity`,`entity_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`type` text DEFAULT 'wedding' NOT NULL,
	`title_en` text,
	`title_ar` text,
	`title_fr` text,
	`date_main` text NOT NULL,
	`dates_extra` text,
	`theme` text NOT NULL,
	`languages` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`payment_status` text DEFAULT 'pending' NOT NULL,
	`retention_months` integer DEFAULT 6 NOT NULL,
	`purged_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT "events_status" CHECK("events"."status" IN ('draft','live','archived')),
	CONSTRAINT "events_payment" CHECK("events"."payment_status" IN ('pending','deposit','paid'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `invitations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`token` text NOT NULL,
	`guest_label` text NOT NULL,
	`max_seats` integer NOT NULL,
	`phone` text,
	`lang` text,
	`group_tag` text,
	`revoked` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "invitations_max_seats" CHECK("invitations"."max_seats" >= 1),
	CONSTRAINT "invitations_lang" CHECK("invitations"."lang" IS NULL OR "invitations"."lang" IN ('ar','fr','en'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invitations_token_unique` ON `invitations` (`token`);--> statement-breakpoint
CREATE INDEX `invitations_event_idx` ON `invitations` (`event_id`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`kind` text NOT NULL,
	`label_en` text,
	`label_ar` text,
	`label_fr` text,
	`maps_url` text,
	`lat` real,
	`lng` real,
	`starts_at` text,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "locations_kind" CHECK("locations"."kind" IN ('house_groom','house_bride','ceremony','reception','other'))
);
--> statement-breakpoint
CREATE INDEX `locations_event_idx` ON `locations` (`event_id`);--> statement-breakpoint
CREATE TABLE `outbox` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`recipient` text NOT NULL,
	`url` text NOT NULL,
	`event_id` text,
	`created_at` text NOT NULL,
	`consumed_at` text
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `rsvps` (
	`invitation_id` text PRIMARY KEY NOT NULL,
	`attending` integer NOT NULL,
	`confirmed_seats` integer NOT NULL,
	`note` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`invitation_id`) REFERENCES `invitations`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rsvps_seats_positive" CHECK("rsvps"."confirmed_seats" >= 0)
);
