import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb, type TestDb } from '../helpers/db';
import { makeEvent, makeInvitation } from '../helpers/fixtures';
import { submitRsvp, getRsvpState } from '../../src/lib/server/services/rsvp';
import { createInvitations } from '../../src/lib/server/services/invitations';
import { rsvps, auditLog, invitations } from '../../src/lib/server/db/schema';

const TOKEN = 'TESTTOKENabcdefghij22';

describe('submitRsvp', () => {
	let db: TestDb;

	beforeEach(async () => {
		db = testDb().db;
		await makeEvent(db);
		await makeInvitation(db, { maxSeats: 3 });
	});

	it('accepts an attending answer within the allowance', async () => {
		const result = await submitRsvp(db, {
			token: TOKEN,
			attending: true,
			seats: 2,
			note: 'Mabrouk!'
		});
		expect(result.ok).toBe(true);
		const rows = await db.select().from(rsvps);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ attending: true, confirmedSeats: 2, note: 'Mabrouk!' });
	});

	it('overwrites on re-answer instead of duplicating (one card = one answer)', async () => {
		await submitRsvp(db, { token: TOKEN, attending: true, seats: 3 });
		const result = await submitRsvp(db, { token: TOKEN, attending: false, seats: 0 });
		expect(result.ok).toBe(true);
		const rows = await db.select().from(rsvps);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({ attending: false, confirmedSeats: 0 });
	});

	it('forces seats to 0 when declining, whatever the client sent', async () => {
		await submitRsvp(db, { token: TOKEN, attending: false, seats: 3 });
		const [row] = await db.select().from(rsvps);
		expect(row!.confirmedSeats).toBe(0);
	});

	it('rejects seats above the allowance', async () => {
		const result = await submitRsvp(db, { token: TOKEN, attending: true, seats: 4 });
		expect(result).toEqual({ ok: false, error: 'seats_exceed_allowance' });
		expect(await db.select().from(rsvps)).toHaveLength(0);
	});

	it('rejects attending with zero seats', async () => {
		const result = await submitRsvp(db, { token: TOKEN, attending: true, seats: 0 });
		expect(result).toEqual({ ok: false, error: 'invalid' });
	});

	it('rejects an unknown token', async () => {
		const result = await submitRsvp(db, { token: 'NOPE', attending: true, seats: 1 });
		expect(result).toEqual({ ok: false, error: 'not_found' });
	});

	it('rejects a revoked card', async () => {
		await db.update(invitations).set({ revoked: true }).where(eq(invitations.token, TOKEN));
		const result = await submitRsvp(db, { token: TOKEN, attending: true, seats: 1 });
		expect(result).toEqual({ ok: false, error: 'revoked' });
	});

	it('rejects when the event is not live', async () => {
		await makeEvent(db, { id: 'ev_draft', slug: 'draft-ev', status: 'draft' });
		await makeInvitation(db, { id: 'inv_d', eventId: 'ev_draft', token: 'DRAFTTOKEN' });
		const result = await submitRsvp(db, { token: 'DRAFTTOKEN', attending: true, seats: 1 });
		expect(result).toEqual({ ok: false, error: 'not_live' });
	});

	it('truncates notes to 500 characters', async () => {
		await submitRsvp(db, { token: TOKEN, attending: true, seats: 1, note: 'x'.repeat(600) });
		const [row] = await db.select().from(rsvps);
		expect(row!.note).toHaveLength(500);
	});

	it('writes an audit row identifying the card, never the token', async () => {
		await submitRsvp(db, { token: TOKEN, attending: true, seats: 2 });
		const rows = await db.select().from(auditLog);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			action: 'rsvp.submit',
			entity: 'invitation',
			entityId: 'inv_test1'
		});
		expect(JSON.stringify(rows[0])).not.toContain(TOKEN);
	});
});

describe('getRsvpState', () => {
	it('returns the invitation label, allowance and current answer', async () => {
		const { db } = testDb();
		await makeEvent(db);
		await makeInvitation(db, { maxSeats: 3 });
		expect(await getRsvpState(db, 'NOPE')).toBeNull();
		const before = await getRsvpState(db, TOKEN);
		expect(before).toMatchObject({ guestLabel: 'Elie & Maya Karam', maxSeats: 3, rsvp: null });
		await submitRsvp(db, { token: TOKEN, attending: true, seats: 2 });
		const after = await getRsvpState(db, TOKEN);
		expect(after!.rsvp).toMatchObject({ attending: true, confirmedSeats: 2 });
	});
});

describe('createInvitations', () => {
	it('bulk-creates cards with unique generated tokens', async () => {
		const { db } = testDb();
		await makeEvent(db);
		const created = await createInvitations(db, 'ev_test1', [
			{ guestLabel: 'A', maxSeats: 1 },
			{ guestLabel: 'B', maxSeats: 2, phone: '9613123456', lang: 'ar', groupTag: 'family' },
			{ guestLabel: 'C', maxSeats: 4 }
		]);
		expect(created).toHaveLength(3);
		const tokens = new Set(created.map((c) => c.token));
		expect(tokens.size).toBe(3);
		for (const token of tokens) expect(token).toMatch(/^[1-9A-HJ-NP-Za-km-z]{22}$/);
		const rows = await db.select().from(invitations);
		expect(rows).toHaveLength(3);
		expect(rows.find((r) => r.guestLabel === 'B')).toMatchObject({
			lang: 'ar',
			groupTag: 'family'
		});
	});
});
