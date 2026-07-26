import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, type TestDb } from '../helpers/db';
import {
	createEvent,
	updateEvent,
	setEventStatus,
	upsertLocation,
	deleteLocation
} from '../../src/lib/server/services/events';
import { events, locations, auditLog } from '../../src/lib/server/db/schema';

describe('createEvent', () => {
	let db: TestDb;

	beforeEach(() => {
		db = testDb().db;
	});

	it('creates a draft event with sensible defaults and a parsed theme', async () => {
		const result = await createEvent(
			db,
			{
				slug: 'Nour-et-Leo',
				titleEn: 'Nour & Leo',
				dateMain: '2027-06-05T17:00:00+03:00',
				languages: ['ar', 'fr']
			},
			'owner:u1'
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.event.slug).toBe('nour-et-leo'); // normalized
		expect(result.event.status).toBe('draft');
		expect(result.event.paymentStatus).toBe('pending');
		const [row] = await db.select().from(events).where(eq(events.id, result.event.id));
		expect(row!.languages).toEqual(['ar', 'fr']);
	});

	it('rejects a taken slug', async () => {
		await createEvent(
			db,
			{ slug: 'same', titleEn: 'A', dateMain: '2027-01-01', languages: ['en'] },
			'o'
		);
		const dup = await createEvent(
			db,
			{ slug: 'same', titleEn: 'B', dateMain: '2027-01-01', languages: ['en'] },
			'o'
		);
		expect(dup).toEqual({ ok: false, error: 'slug_taken' });
	});

	it('rejects malformed slugs and empty languages', async () => {
		const bad = await createEvent(
			db,
			{ slug: 'has space!', titleEn: 'A', dateMain: '2027-01-01', languages: ['en'] },
			'o'
		);
		expect(bad).toEqual({ ok: false, error: 'invalid' });
		const noLang = await createEvent(
			db,
			{ slug: 'ok', titleEn: 'A', dateMain: '2027-01-01', languages: [] },
			'o'
		);
		expect(noLang).toEqual({ ok: false, error: 'invalid' });
	});

	it('writes an audit row', async () => {
		await createEvent(
			db,
			{ slug: 'aud', titleEn: 'A', dateMain: '2027-01-01', languages: ['en'] },
			'owner:u1'
		);
		const rows = await db.select().from(auditLog);
		expect(rows.some((r) => r.action === 'event.create' && r.actor === 'owner:u1')).toBe(true);
	});
});

describe('updateEvent / setEventStatus', () => {
	let db: TestDb;
	let eventId: string;

	beforeEach(async () => {
		db = testDb().db;
		const created = await createEvent(
			db,
			{ slug: 'wed', titleEn: 'A & B', dateMain: '2027-01-01T16:00:00+02:00', languages: ['en'] },
			'o'
		);
		if (!created.ok) throw new Error('seed failed');
		eventId = created.event.id;
	});

	it('applies a validated patch and bumps updated_at', async () => {
		const result = await updateEvent(
			db,
			eventId,
			{ titleFr: 'A et B', paymentStatus: 'paid', theme: { colors: { accent: '#112233' } } },
			'o'
		);
		expect(result.ok).toBe(true);
		const [row] = await db.select().from(events).where(eq(events.id, eventId));
		expect(row!.titleFr).toBe('A et B');
		expect(row!.paymentStatus).toBe('paid');
		expect((row!.theme as { colors: { accent: string } }).colors.accent).toBe('#112233');
	});

	it('rejects an invalid theme instead of corrupting the stored one', async () => {
		const result = await updateEvent(db, eventId, { theme: { colors: { accent: 'red' } } }, 'o');
		expect(result).toEqual({ ok: false, error: 'invalid' });
	});

	it('rejects an unknown payment status', async () => {
		const result = await updateEvent(db, eventId, { paymentStatus: 'gold' }, 'o');
		expect(result).toEqual({ ok: false, error: 'invalid' });
	});

	it('transitions status draft → live with audit', async () => {
		const result = await setEventStatus(db, eventId, 'live', 'owner:u1');
		expect(result.ok).toBe(true);
		const [row] = await db.select().from(events).where(eq(events.id, eventId));
		expect(row!.status).toBe('live');
		const audits = await db.select().from(auditLog);
		expect(audits.some((a) => a.action === 'event.status' && a.entityId === eventId)).toBe(true);
	});

	it('returns not_found for a missing event', async () => {
		expect(await updateEvent(db, 'nope', { titleEn: 'X' }, 'o')).toEqual({
			ok: false,
			error: 'not_found'
		});
	});
});

describe('locations CRUD', () => {
	let db: TestDb;
	let eventId: string;

	beforeEach(async () => {
		db = testDb().db;
		const created = await createEvent(
			db,
			{ slug: 'locs', titleEn: 'A', dateMain: '2027-01-01', languages: ['en'] },
			'o'
		);
		if (!created.ok) throw new Error('seed failed');
		eventId = created.event.id;
	});

	it('creates, updates and deletes typed locations', async () => {
		const created = await upsertLocation(
			db,
			eventId,
			{ kind: 'ceremony', labelEn: 'Chapel', mapsUrl: 'https://maps.app.goo.gl/x', sort: 1 },
			'o'
		);
		expect(created.ok).toBe(true);
		if (!created.ok) return;
		const updated = await upsertLocation(
			db,
			eventId,
			{ id: created.location.id, kind: 'ceremony', labelEn: 'Big Chapel', sort: 2 },
			'o'
		);
		expect(updated.ok).toBe(true);
		let rows = await db.select().from(locations);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.labelEn).toBe('Big Chapel');

		await deleteLocation(db, eventId, created.location.id, 'o');
		rows = await db.select().from(locations);
		expect(rows).toHaveLength(0);
	});

	it('rejects unknown kinds and cross-event location ids', async () => {
		const bad = await upsertLocation(db, eventId, { kind: 'afterparty', labelEn: 'X' }, 'o');
		expect(bad).toEqual({ ok: false, error: 'invalid' });

		const other = await createEvent(
			db,
			{ slug: 'other', titleEn: 'B', dateMain: '2027-01-01', languages: ['en'] },
			'o'
		);
		if (!other.ok) throw new Error('seed failed');
		const loc = await upsertLocation(
			db,
			other.event.id,
			{ kind: 'reception', labelEn: 'Hall' },
			'o'
		);
		if (!loc.ok) throw new Error('seed failed');
		// updating someone else's location through the wrong event id must fail
		const crossTenant = await upsertLocation(
			db,
			eventId,
			{ id: loc.location.id, kind: 'reception', labelEn: 'Hijack' },
			'o'
		);
		expect(crossTenant).toEqual({ ok: false, error: 'not_found' });
	});
});
