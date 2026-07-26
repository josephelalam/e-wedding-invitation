import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db';
import { events, invitations, locations } from '../db/schema';
import { parseTheme, DEFAULT_THEME, type Theme } from '$lib/themes/schema';
import { newId } from '../crypto';
import { audit } from './audit';

export type InvitationPageData = {
	event: {
		id: string;
		slug: string;
		type: string;
		titleEn: string | null;
		titleAr: string | null;
		titleFr: string | null;
		dateMain: string;
		datesExtra: { label: Partial<Record<'ar' | 'fr' | 'en', string>>; at: string }[];
		languages: string[];
	};
	theme: Theme;
	locations: (typeof locations.$inferSelect)[];
	invitation: { id: string; guestLabel: string; maxSeats: number; lang: string | null };
};

/**
 * Token → personalized page data. Null (→ graceful invalid page) for unknown
 * slug/token, token/slug mismatch, revoked cards, and non-live events. The
 * theme always parses: a hand-edited JSON must never blank a wedding.
 */
export async function loadInvitationPage(
	db: Db,
	slug: string,
	token: string
): Promise<InvitationPageData | null> {
	const [row] = await db
		.select({ event: events, invitation: invitations })
		.from(invitations)
		.innerJoin(events, eq(invitations.eventId, events.id))
		.where(and(eq(invitations.token, token), eq(events.slug, slug)))
		.limit(1);
	if (!row || row.invitation.revoked || row.event.status !== 'live') return null;

	let theme: Theme;
	try {
		theme = parseTheme(row.event.theme);
	} catch {
		theme = DEFAULT_THEME;
	}

	const locationRows = await db
		.select()
		.from(locations)
		.where(eq(locations.eventId, row.event.id))
		.orderBy(asc(locations.sort), asc(locations.startsAt));

	return {
		event: {
			id: row.event.id,
			slug: row.event.slug,
			type: row.event.type,
			titleEn: row.event.titleEn,
			titleAr: row.event.titleAr,
			titleFr: row.event.titleFr,
			dateMain: row.event.dateMain,
			datesExtra: row.event.datesExtra ?? [],
			languages: row.event.languages
		},
		theme,
		locations: locationRows,
		invitation: {
			id: row.invitation.id,
			guestLabel: row.invitation.guestLabel,
			maxSeats: row.invitation.maxSeats,
			lang: row.invitation.lang
		}
	};
}

// ─── Studio CRUD (owner-only surface) ────────────────────────────────────────

export type EventError = 'invalid' | 'slug_taken' | 'not_found';
type EventRow = typeof events.$inferSelect;
type LocationRow = typeof locations.$inferSelect;
export type EventResult = { ok: true; event: EventRow } | { ok: false; error: EventError };
export type LocationResult = { ok: true; location: LocationRow } | { ok: false; error: EventError };

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const localizedText = z.object({
	ar: z.string().optional(),
	fr: z.string().optional(),
	en: z.string().optional()
});

const CreateEventSchema = z.object({
	slug: z
		.string()
		.trim()
		.toLowerCase()
		.min(2)
		.max(60)
		.refine((s) => SLUG_RE.test(s), 'slug must be kebab-case'),
	type: z.string().trim().min(1).max(30).default('wedding'),
	titleEn: z.string().trim().max(120).nullish(),
	titleAr: z.string().trim().max(120).nullish(),
	titleFr: z.string().trim().max(120).nullish(),
	dateMain: z.string().trim().min(4),
	datesExtra: z.array(z.object({ label: localizedText, at: z.string().min(4) })).optional(),
	languages: z.array(z.enum(['ar', 'fr', 'en'])).min(1),
	theme: z.unknown().optional()
});

export async function createEvent(db: Db, input: unknown, actor: string): Promise<EventResult> {
	const parsed = CreateEventSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: 'invalid' };
	let theme: Theme;
	try {
		theme = parseTheme(parsed.data.theme ?? {});
	} catch {
		return { ok: false, error: 'invalid' };
	}
	const now = new Date().toISOString();
	const row: typeof events.$inferInsert = {
		id: newId(),
		slug: parsed.data.slug,
		type: parsed.data.type,
		titleEn: parsed.data.titleEn ?? null,
		titleAr: parsed.data.titleAr ?? null,
		titleFr: parsed.data.titleFr ?? null,
		dateMain: parsed.data.dateMain,
		datesExtra: parsed.data.datesExtra ?? [],
		theme,
		languages: parsed.data.languages,
		status: 'draft',
		paymentStatus: 'pending',
		retentionMonths: 6,
		createdAt: now,
		updatedAt: now
	};
	try {
		await db.insert(events).values(row);
	} catch (err) {
		if (String(err).includes('UNIQUE')) return { ok: false, error: 'slug_taken' };
		throw err;
	}
	await audit(db, actor, 'event.create', 'event', row.id);
	const [created] = await db.select().from(events).where(eq(events.id, row.id));
	return { ok: true, event: created! };
}

const UpdateEventSchema = CreateEventSchema.omit({ slug: true })
	.partial()
	.extend({
		paymentStatus: z.enum(['pending', 'deposit', 'paid']).optional(),
		retentionMonths: z.number().int().min(1).max(36).optional()
	});

export async function updateEvent(
	db: Db,
	eventId: string,
	patch: unknown,
	actor: string
): Promise<EventResult> {
	const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	if (!existing) return { ok: false, error: 'not_found' };
	const parsed = UpdateEventSchema.safeParse(patch);
	if (!parsed.success) return { ok: false, error: 'invalid' };

	const set: Partial<typeof events.$inferInsert> = { updatedAt: new Date().toISOString() };
	const data = parsed.data;
	if (data.theme !== undefined) {
		try {
			set.theme = parseTheme(data.theme);
		} catch {
			return { ok: false, error: 'invalid' };
		}
	}
	for (const key of [
		'type',
		'titleEn',
		'titleAr',
		'titleFr',
		'dateMain',
		'datesExtra',
		'languages',
		'paymentStatus',
		'retentionMonths'
	] as const) {
		if (data[key] !== undefined) {
			(set as Record<string, unknown>)[key] = data[key];
		}
	}
	await db.update(events).set(set).where(eq(events.id, eventId));
	await audit(db, actor, 'event.update', 'event', eventId, { fields: Object.keys(set) });
	const [updated] = await db.select().from(events).where(eq(events.id, eventId));
	return { ok: true, event: updated! };
}

export async function setEventStatus(
	db: Db,
	eventId: string,
	status: 'draft' | 'live' | 'archived',
	actor: string
): Promise<EventResult> {
	const [existing] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
	if (!existing) return { ok: false, error: 'not_found' };
	await db
		.update(events)
		.set({ status, updatedAt: new Date().toISOString() })
		.where(eq(events.id, eventId));
	await audit(db, actor, 'event.status', 'event', eventId, { to: status });
	const [updated] = await db.select().from(events).where(eq(events.id, eventId));
	return { ok: true, event: updated! };
}

const LocationSchema = z.object({
	id: z.string().optional(),
	kind: z.enum(['house_groom', 'house_bride', 'ceremony', 'reception', 'other']),
	labelEn: z.string().trim().max(160).nullish(),
	labelAr: z.string().trim().max(160).nullish(),
	labelFr: z.string().trim().max(160).nullish(),
	mapsUrl: z
		.url()
		.max(500)
		.nullish()
		.or(z.literal('').transform(() => null)),
	lat: z.number().nullish(),
	lng: z.number().nullish(),
	startsAt: z
		.string()
		.nullish()
		.or(z.literal('').transform(() => null)),
	sort: z.number().int().min(0).max(999).default(0)
});

export async function upsertLocation(
	db: Db,
	eventId: string,
	input: unknown,
	actor: string
): Promise<LocationResult> {
	const parsed = LocationSchema.safeParse(input);
	if (!parsed.success) return { ok: false, error: 'invalid' };
	const data = parsed.data;
	let id = data.id;
	if (id) {
		const [existing] = await db
			.select({ id: locations.id })
			.from(locations)
			.where(and(eq(locations.id, id), eq(locations.eventId, eventId)))
			.limit(1);
		if (!existing) return { ok: false, error: 'not_found' };
		await db
			.update(locations)
			.set({
				kind: data.kind,
				labelEn: data.labelEn ?? null,
				labelAr: data.labelAr ?? null,
				labelFr: data.labelFr ?? null,
				mapsUrl: data.mapsUrl ?? null,
				lat: data.lat ?? null,
				lng: data.lng ?? null,
				startsAt: data.startsAt ?? null,
				sort: data.sort
			})
			.where(and(eq(locations.id, id), eq(locations.eventId, eventId)));
		await audit(db, actor, 'location.update', 'event', eventId, { locationId: id });
	} else {
		id = newId();
		await db.insert(locations).values({
			id,
			eventId,
			kind: data.kind,
			labelEn: data.labelEn ?? null,
			labelAr: data.labelAr ?? null,
			labelFr: data.labelFr ?? null,
			mapsUrl: data.mapsUrl ?? null,
			lat: data.lat ?? null,
			lng: data.lng ?? null,
			startsAt: data.startsAt ?? null,
			sort: data.sort
		});
		await audit(db, actor, 'location.create', 'event', eventId, { locationId: id });
	}
	const [row] = await db.select().from(locations).where(eq(locations.id, id));
	return { ok: true, location: row! };
}

export async function deleteLocation(
	db: Db,
	eventId: string,
	locationId: string,
	actor: string
): Promise<{ ok: boolean }> {
	await db
		.delete(locations)
		.where(and(eq(locations.id, locationId), eq(locations.eventId, eventId)));
	await audit(db, actor, 'location.delete', 'event', eventId, { locationId });
	return { ok: true };
}
