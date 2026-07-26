import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { testDb } from '../helpers/db';
import { makeEvent, makeInvitation } from '../helpers/fixtures';
import { submitRsvp } from '../../src/lib/server/services/rsvp';
import { nightly } from '../../src/lib/server/jobs';
import {
	events,
	invitations,
	rsvps,
	rateLimits,
	outbox,
	auditLog
} from '../../src/lib/server/db/schema';

type PutCall = { key: string; value: string };

function bucketStub() {
	const puts: PutCall[] = [];
	return {
		puts,
		async put(key: string, value: string) {
			puts.push({ key, value });
		}
	};
}

describe('nightly backup (spec §7.4 — survives account-level mistakes)', () => {
	it('dumps every domain table as JSONL plus a manifest with counts', async () => {
		const { db } = testDb();
		await makeEvent(db);
		await makeInvitation(db);
		await submitRsvp(db, { token: 'TESTTOKENabcdefghij22', attending: true, seats: 2 });
		const bucket = bucketStub();

		await nightly(db, bucket, new Date('2026-07-26T02:00:00Z'));

		const keys = bucket.puts.map((p) => p.key);
		expect(keys).toContain('backups/2026-07-26/events.jsonl');
		expect(keys).toContain('backups/2026-07-26/invitations.jsonl');
		expect(keys).toContain('backups/2026-07-26/rsvps.jsonl');
		expect(keys).toContain('backups/2026-07-26/manifest.json');

		const manifest = JSON.parse(
			bucket.puts.find((p) => p.key.endsWith('manifest.json'))!.value
		) as Record<string, number>;
		expect(manifest['events']).toBe(1);
		expect(manifest['invitations']).toBe(1);
		expect(manifest['rsvps']).toBe(1);

		const invitationLine = bucket.puts.find((p) => p.key.endsWith('invitations.jsonl'))!.value;
		expect(JSON.parse(invitationLine.trim().split('\n')[0]!).guest_label).toBe('Elie & Maya Karam');
	});
});

describe('retention purge (spec §7.3 — PII deleted N months post-event)', () => {
	it('archives past-retention events and strips guest PII, keeping aggregates', async () => {
		const { db } = testDb();
		// Wedding on 2026-01-10 with 6-month retention → purgeable after 2026-07-10
		await makeEvent(db, { id: 'ev_old', slug: 'old', dateMain: '2026-01-10T16:00:00+02:00' });
		await makeInvitation(db, {
			id: 'inv_old',
			eventId: 'ev_old',
			token: 'OLDTOK',
			guestLabel: 'Teta Georgette',
			phone: '9613123456'
		});
		await submitRsvp(db, { token: 'OLDTOK', attending: true, seats: 2, note: 'personal note' });
		// Fresh wedding must stay untouched
		await makeEvent(db, { id: 'ev_new', slug: 'new', dateMain: '2026-07-01T16:00:00+02:00' });
		await makeInvitation(db, { id: 'inv_new', eventId: 'ev_new', token: 'NEWTOK' });

		await nightly(db, bucketStub(), new Date('2026-07-26T02:00:00Z'));

		const [oldEvent] = await db.select().from(events).where(eq(events.id, 'ev_old'));
		expect(oldEvent!.status).toBe('archived');
		expect(oldEvent!.purgedAt).not.toBeNull();

		const [oldInvitation] = await db
			.select()
			.from(invitations)
			.where(eq(invitations.id, 'inv_old'));
		expect(oldInvitation!.guestLabel).toBe('purged');
		expect(oldInvitation!.phone).toBeNull();

		const [oldRsvp] = await db.select().from(rsvps).where(eq(rsvps.invitationId, 'inv_old'));
		expect(oldRsvp!.note).toBeNull();
		expect(oldRsvp!.confirmedSeats).toBe(2); // seat totals survive for the couple

		const [newInvitation] = await db
			.select()
			.from(invitations)
			.where(eq(invitations.id, 'inv_new'));
		expect(newInvitation!.guestLabel).toBe('Elie & Maya Karam');

		const audits = await db.select().from(auditLog);
		expect(audits.some((a) => a.action === 'retention.purge' && a.entityId === 'ev_old')).toBe(
			true
		);
	});

	it('does not purge twice', async () => {
		const { db } = testDb();
		await makeEvent(db, { id: 'ev_old', slug: 'old', dateMain: '2026-01-10T16:00:00+02:00' });
		await nightly(db, bucketStub(), new Date('2026-07-26T02:00:00Z'));
		await nightly(db, bucketStub(), new Date('2026-07-27T02:00:00Z'));
		const audits = await db.select().from(auditLog);
		expect(audits.filter((a) => a.action === 'retention.purge')).toHaveLength(1);
	});
});

describe('housekeeping', () => {
	it('drops expired rate-limit windows and stale consumed outbox rows', async () => {
		const { db } = testDb();
		await db.insert(rateLimits).values([
			{ key: 'old', count: 3, resetAt: 1_000 },
			{
				key: 'live',
				count: 1,
				resetAt: Math.floor(new Date('2026-07-26T03:00:00Z').getTime() / 1000) + 600
			}
		]);
		await db.insert(outbox).values([
			{
				id: 'ob_old',
				kind: 'magic_link',
				recipient: 'a@x',
				url: 'https://x/1',
				createdAt: '2026-05-01T00:00:00Z',
				consumedAt: '2026-05-01T01:00:00Z'
			},
			{
				id: 'ob_live',
				kind: 'magic_link',
				recipient: 'b@x',
				url: 'https://x/2',
				createdAt: '2026-07-25T00:00:00Z',
				consumedAt: null
			}
		]);

		await nightly(db, bucketStub(), new Date('2026-07-26T02:00:00Z'));

		expect((await db.select().from(rateLimits)).map((r) => r.key)).toEqual(['live']);
		expect((await db.select().from(outbox)).map((r) => r.id)).toEqual(['ob_live']);
	});
});
