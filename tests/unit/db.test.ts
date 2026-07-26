import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, type TestDb } from '../helpers/db';
import { makeEvent, makeInvitation } from '../helpers/fixtures';
import { events, invitations, rsvps } from '../../src/lib/server/db/schema';

describe('data model integrity (runs the real D1 migration SQL)', () => {
	let db: TestDb;

	beforeEach(() => {
		db = testDb().db;
	});

	it('accepts an rsvp within the seat allowance', async () => {
		await makeEvent(db);
		await makeInvitation(db, { maxSeats: 3 });
		await db.insert(rsvps).values({
			invitationId: 'inv_test1',
			attending: true,
			confirmedSeats: 3,
			updatedAt: '2026-07-26T12:00:00.000Z'
		});
		const rows = await db.select().from(rsvps);
		expect(rows).toHaveLength(1);
		expect(rows[0]!.attending).toBe(true);
	});

	it('the DB trigger rejects seats above the card allowance on INSERT', async () => {
		await makeEvent(db);
		await makeInvitation(db, { maxSeats: 2 });
		await expect(
			db.insert(rsvps).values({
				invitationId: 'inv_test1',
				attending: true,
				confirmedSeats: 3,
				updatedAt: '2026-07-26T12:00:00.000Z'
			})
		).rejects.toThrow(/seats_exceed_allowance/);
	});

	it('the DB trigger rejects seats above the card allowance on UPDATE', async () => {
		await makeEvent(db);
		await makeInvitation(db, { maxSeats: 2 });
		await db.insert(rsvps).values({
			invitationId: 'inv_test1',
			attending: true,
			confirmedSeats: 2,
			updatedAt: '2026-07-26T12:00:00.000Z'
		});
		await expect(
			db.update(rsvps).set({ confirmedSeats: 5 }).where(eq(rsvps.invitationId, 'inv_test1'))
		).rejects.toThrow(/seats_exceed_allowance/);
	});

	it('rejects negative confirmed seats (CHECK)', async () => {
		await makeEvent(db);
		await makeInvitation(db);
		await expect(
			db.insert(rsvps).values({
				invitationId: 'inv_test1',
				attending: false,
				confirmedSeats: -1,
				updatedAt: '2026-07-26T12:00:00.000Z'
			})
		).rejects.toThrow();
	});

	it('rejects invitations with zero seats (CHECK max_seats >= 1)', async () => {
		await makeEvent(db);
		await expect(makeInvitation(db, { maxSeats: 0 })).rejects.toThrow();
	});

	it('enforces unique event slugs', async () => {
		await makeEvent(db, { id: 'ev_a', slug: 'same' });
		await expect(makeEvent(db, { id: 'ev_b', slug: 'same' })).rejects.toThrow();
	});

	it('enforces unique invitation tokens', async () => {
		await makeEvent(db);
		await makeInvitation(db, { id: 'inv_a', token: 'DUP' });
		await expect(makeInvitation(db, { id: 'inv_b', token: 'DUP' })).rejects.toThrow();
	});

	it('rejects unknown event status (CHECK)', async () => {
		await expect(makeEvent(db, { status: 'published' })).rejects.toThrow();
	});

	it('cascades event deletion to invitations and rsvps', async () => {
		await makeEvent(db);
		await makeInvitation(db);
		await db.insert(rsvps).values({
			invitationId: 'inv_test1',
			attending: true,
			confirmedSeats: 1,
			updatedAt: '2026-07-26T12:00:00.000Z'
		});
		await db.delete(events).where(eq(events.id, 'ev_test1'));
		expect(await db.select().from(invitations)).toHaveLength(0);
		expect(await db.select().from(rsvps)).toHaveLength(0);
	});

	it('round-trips JSON columns (theme, languages)', async () => {
		await makeEvent(db, { theme: { preset: 'midnight' }, languages: ['ar'] });
		const [row] = await db.select().from(events);
		expect(row!.theme).toEqual({ preset: 'midnight' });
		expect(row!.languages).toEqual(['ar']);
	});
});
