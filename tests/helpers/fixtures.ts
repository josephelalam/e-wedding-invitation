import type { TestDb } from './db';
import { events, invitations } from '../../src/lib/server/db/schema';

const NOW = '2026-07-26T12:00:00.000Z';

type EventOverrides = Partial<typeof events.$inferInsert>;
type InvitationOverrides = Partial<typeof invitations.$inferInsert>;

export async function makeEvent(db: TestDb, over: EventOverrides = {}) {
	const row: typeof events.$inferInsert = {
		id: 'ev_test1',
		slug: 'demo-wedding',
		type: 'wedding',
		titleEn: 'Elie & Maya',
		titleAr: 'ايلي ومايا',
		titleFr: 'Elie & Maya',
		dateMain: '2026-09-12T16:00:00+03:00',
		theme: {},
		languages: ['ar', 'fr', 'en'],
		status: 'live',
		createdAt: NOW,
		updatedAt: NOW,
		...over
	};
	await db.insert(events).values(row);
	return row;
}

export async function makeInvitation(db: TestDb, over: InvitationOverrides = {}) {
	const row: typeof invitations.$inferInsert = {
		id: 'inv_test1',
		eventId: 'ev_test1',
		token: 'TESTTOKENabcdefghij22',
		guestLabel: 'Elie & Maya Karam',
		maxSeats: 3,
		createdAt: NOW,
		...over
	};
	await db.insert(invitations).values(row);
	return row;
}
