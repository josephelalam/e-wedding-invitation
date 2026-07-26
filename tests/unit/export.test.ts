import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, type TestDb } from '../helpers/db';
import { makeEvent, makeInvitation } from '../helpers/fixtures';
import { submitRsvp } from '../../src/lib/server/services/rsvp';
import { eventStats, rsvpRows, toCsv } from '../../src/lib/server/services/export';

async function seedAnswers(db: TestDb) {
	await makeEvent(db);
	await makeInvitation(db, { id: 'i1', token: 'T1', guestLabel: 'Confirmed Couple', maxSeats: 2 });
	await makeInvitation(db, {
		id: 'i2',
		token: 'T2',
		guestLabel: 'Declined Guest',
		maxSeats: 1,
		groupTag: 'work'
	});
	await makeInvitation(db, { id: 'i3', token: 'T3', guestLabel: 'شكري الصامت', maxSeats: 3 });
	await submitRsvp(db, { token: 'T1', attending: true, seats: 2, note: 'Yalla!' });
	await submitRsvp(db, { token: 'T2', attending: false, seats: 0 });
}

describe('eventStats', () => {
	let db: TestDb;

	beforeEach(async () => {
		db = testDb().db;
		await seedAnswers(db);
	});

	it('aggregates cards, seats and pending correctly', async () => {
		expect(await eventStats(db, 'ev_test1')).toEqual({
			cards: 3,
			confirmedCards: 1,
			declinedCards: 1,
			pendingCards: 1,
			confirmedSeats: 2
		});
	});
});

describe('rsvpRows', () => {
	let db: TestDb;

	beforeEach(async () => {
		db = testDb().db;
		await seedAnswers(db);
	});

	it('returns every card with its answer state', async () => {
		const rows = await rsvpRows(db, 'ev_test1');
		expect(rows).toHaveLength(3);
		const byLabel = Object.fromEntries(rows.map((r) => [r.guestLabel, r]));
		expect(byLabel['Confirmed Couple']).toMatchObject({
			status: 'confirmed',
			confirmedSeats: 2,
			note: 'Yalla!'
		});
		expect(byLabel['Declined Guest']).toMatchObject({ status: 'declined', confirmedSeats: 0 });
		expect(byLabel['شكري الصامت']).toMatchObject({ status: 'pending', confirmedSeats: null });
	});

	it('filters by status and by case-insensitive name search', async () => {
		expect(
			(await rsvpRows(db, 'ev_test1', { status: 'pending' })).map((r) => r.guestLabel)
		).toEqual(['شكري الصامت']);
		expect((await rsvpRows(db, 'ev_test1', { q: 'declined' })).map((r) => r.guestLabel)).toEqual([
			'Declined Guest'
		]);
	});

	it('never leaks another event', async () => {
		await makeEvent(db, { id: 'ev_b', slug: 'b' });
		await makeInvitation(db, { id: 'ib', eventId: 'ev_b', token: 'TB', guestLabel: 'Other' });
		const rows = await rsvpRows(db, 'ev_test1');
		expect(rows.map((r) => r.guestLabel)).not.toContain('Other');
	});
});

describe('toCsv', () => {
	it('produces Excel-friendly UTF-8 (BOM), quoting commas, quotes and newlines', async () => {
		const { db } = testDb();
		await seedAnswers(db);
		await submitRsvp(db, { token: 'T1', attending: true, seats: 2, note: 'line1\nwith, "quotes"' });
		const csv = toCsv(await rsvpRows(db, 'ev_test1'));
		expect(csv.startsWith('﻿')).toBe(true); // Arabic names must open correctly in Excel
		const [header] = csv.replace('﻿', '').split('\r\n');
		expect(header).toBe(
			'guest_label,max_seats,status,confirmed_seats,note,phone,lang,group_tag,answered_at'
		);
		expect(csv).toContain('"line1\nwith, ""quotes"""');
		expect(csv).toContain('شكري الصامت');
	});
});
