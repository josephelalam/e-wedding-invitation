import { sqliteTable, text, integer, real, index, check } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// Spec §5 — event-agnostic model: `events`, not `weddings`; locations are an
// ordered typed list; one invitation card = one authoritative RSVP row.

export type LocalizedText = Partial<Record<'ar' | 'fr' | 'en', string>>;
export type ExtraDate = { label: LocalizedText; at: string };

export const events = sqliteTable(
	'events',
	{
		id: text('id').primaryKey(),
		slug: text('slug').notNull().unique(),
		type: text('type').notNull().default('wedding'),
		titleEn: text('title_en'),
		titleAr: text('title_ar'),
		titleFr: text('title_fr'),
		dateMain: text('date_main').notNull(),
		datesExtra: text('dates_extra', { mode: 'json' }).$type<ExtraDate[]>(),
		theme: text('theme', { mode: 'json' }).$type<unknown>().notNull(),
		languages: text('languages', { mode: 'json' }).$type<string[]>().notNull(),
		status: text('status').notNull().default('draft'),
		paymentStatus: text('payment_status').notNull().default('pending'),
		retentionMonths: integer('retention_months').notNull().default(6),
		purgedAt: text('purged_at'),
		createdAt: text('created_at').notNull(),
		updatedAt: text('updated_at').notNull()
	},
	(t) => [
		check('events_status', sql`${t.status} IN ('draft','live','archived')`),
		check('events_payment', sql`${t.paymentStatus} IN ('pending','deposit','paid')`)
	]
);

export const locations = sqliteTable(
	'locations',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		labelEn: text('label_en'),
		labelAr: text('label_ar'),
		labelFr: text('label_fr'),
		mapsUrl: text('maps_url'),
		lat: real('lat'),
		lng: real('lng'),
		startsAt: text('starts_at'),
		sort: integer('sort').notNull().default(0)
	},
	(t) => [
		index('locations_event_idx').on(t.eventId),
		check(
			'locations_kind',
			sql`${t.kind} IN ('house_groom','house_bride','ceremony','reception','other')`
		)
	]
);

export const invitations = sqliteTable(
	'invitations',
	{
		id: text('id').primaryKey(),
		eventId: text('event_id')
			.notNull()
			.references(() => events.id, { onDelete: 'cascade' }),
		token: text('token').notNull().unique(),
		guestLabel: text('guest_label').notNull(),
		maxSeats: integer('max_seats').notNull(),
		phone: text('phone'),
		lang: text('lang'),
		groupTag: text('group_tag'),
		revoked: integer('revoked', { mode: 'boolean' }).notNull().default(false),
		createdAt: text('created_at').notNull()
	},
	(t) => [
		index('invitations_event_idx').on(t.eventId),
		check('invitations_max_seats', sql`${t.maxSeats} >= 1`),
		check('invitations_lang', sql`${t.lang} IS NULL OR ${t.lang} IN ('ar','fr','en')`)
	]
);

export const rsvps = sqliteTable(
	'rsvps',
	{
		invitationId: text('invitation_id')
			.primaryKey()
			.references(() => invitations.id, { onDelete: 'cascade' }),
		attending: integer('attending', { mode: 'boolean' }).notNull(),
		confirmedSeats: integer('confirmed_seats').notNull(),
		note: text('note'),
		updatedAt: text('updated_at').notNull()
	},
	(t) => [check('rsvps_seats_positive', sql`${t.confirmedSeats} >= 0`)]
);

export const auditLog = sqliteTable(
	'audit_log',
	{
		id: text('id').primaryKey(),
		actor: text('actor').notNull(),
		action: text('action').notNull(),
		entity: text('entity').notNull(),
		entityId: text('entity_id').notNull(),
		at: text('at').notNull(),
		meta: text('meta', { mode: 'json' }).$type<Record<string, unknown>>()
	},
	(t) => [index('audit_entity_idx').on(t.entity, t.entityId)]
);

// Magic links / notifications that could not be emailed (no email provider on
// the $0 tier) surface here for the owner to forward over WhatsApp.
export const outbox = sqliteTable('outbox', {
	id: text('id').primaryKey(),
	kind: text('kind').notNull(),
	recipient: text('recipient').notNull(),
	url: text('url').notNull(),
	eventId: text('event_id'),
	createdAt: text('created_at').notNull(),
	consumedAt: text('consumed_at')
});

export const rateLimits = sqliteTable('rate_limits', {
	key: text('key').primaryKey(),
	count: integer('count').notNull(),
	resetAt: integer('reset_at').notNull()
});

export * from './auth.schema';
