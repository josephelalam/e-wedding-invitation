import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, type TestDb } from '../helpers/db';
import { makeEvent, makeInvitation } from '../helpers/fixtures';
import { loadInvitationPage } from '../../src/lib/server/services/events';
import { locations } from '../../src/lib/server/db/schema';

const TOKEN = 'TESTTOKENabcdefghij22';

describe('loadInvitationPage', () => {
	let db: TestDb;

	beforeEach(async () => {
		db = testDb().db;
		await makeEvent(db, { theme: { preset: 'midnight', colors: { bg: '#141221' } } });
		await makeInvitation(db, { maxSeats: 2, lang: 'ar' });
	});

	it('returns event, parsed theme, ordered locations and the card personalization', async () => {
		await db.insert(locations).values([
			{
				id: 'loc2',
				eventId: 'ev_test1',
				kind: 'reception',
				labelFr: 'Le Telegraphe',
				mapsUrl: 'https://maps.app.goo.gl/xyz',
				startsAt: '2026-09-12T20:00:00+03:00',
				sort: 2
			},
			{
				id: 'loc1',
				eventId: 'ev_test1',
				kind: 'ceremony',
				labelFr: 'Église Mar Mikhael',
				mapsUrl: 'https://maps.app.goo.gl/abc',
				startsAt: '2026-09-12T17:00:00+03:00',
				sort: 1
			}
		]);
		const page = await loadInvitationPage(db, 'demo-wedding', TOKEN);
		expect(page).not.toBeNull();
		expect(page!.invitation).toEqual({
			id: 'inv_test1',
			guestLabel: 'Elie & Maya Karam',
			maxSeats: 2,
			lang: 'ar'
		});
		expect(page!.theme.colors.bg).toBe('#141221');
		expect(page!.theme.colors.accent).toBeDefined(); // defaults filled
		expect(page!.locations.map((l) => l.id)).toEqual(['loc1', 'loc2']); // sort order
		expect(page!.event.slug).toBe('demo-wedding');
	});

	it('returns null when the token does not belong to that event slug', async () => {
		await makeEvent(db, { id: 'ev_other', slug: 'other-wedding' });
		expect(await loadInvitationPage(db, 'other-wedding', TOKEN)).toBeNull();
	});

	it('returns null for unknown token or slug', async () => {
		expect(await loadInvitationPage(db, 'demo-wedding', 'NOPE')).toBeNull();
		expect(await loadInvitationPage(db, 'nope', TOKEN)).toBeNull();
	});

	it('returns null for revoked cards and non-live events', async () => {
		await makeEvent(db, { id: 'ev_d', slug: 'draft-ev', status: 'draft' });
		await makeInvitation(db, { id: 'inv_d', eventId: 'ev_d', token: 'DRAFTTOK' });
		expect(await loadInvitationPage(db, 'draft-ev', 'DRAFTTOK')).toBeNull();

		await makeInvitation(db, { id: 'inv_r', token: 'REVOKEDTOK', revoked: true });
		expect(await loadInvitationPage(db, 'demo-wedding', 'REVOKEDTOK')).toBeNull();
	});

	it('survives a corrupt theme JSON by falling back to defaults', async () => {
		await makeEvent(db, {
			id: 'ev_bad',
			slug: 'bad-theme',
			theme: { colors: 'nonsense', slideOrder: 'nope' }
		});
		await makeInvitation(db, { id: 'inv_b', eventId: 'ev_bad', token: 'BADTHEMETOK' });
		const page = await loadInvitationPage(db, 'bad-theme', 'BADTHEMETOK');
		expect(page!.theme.preset).toBe('classic');
		expect(page!.theme.slideOrder.length).toBeGreaterThan(0);
	});
});
