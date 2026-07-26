import { describe, it, expect, vi } from 'vitest';
import { testDb } from '../helpers/db';
import { deliverAuthLink, pendingLinks, markConsumed } from '../../src/lib/server/services/outbox';
import { outbox } from '../../src/lib/server/db/schema';

describe('deliverAuthLink', () => {
	it('stores the link in the outbox for WhatsApp forwarding ($0 tier, no email service)', async () => {
		const { db } = testDb();
		await deliverAuthLink(db, {
			kind: 'magic_link',
			email: 'couple@example.com',
			url: 'https://einvite.example/auth/magic?token=x'
		});
		const rows = await db.select().from(outbox);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			kind: 'magic_link',
			recipient: 'couple@example.com',
			url: 'https://einvite.example/auth/magic?token=x',
			consumedAt: null
		});
	});

	it('also emails when a sender is configured, and still stores the row', async () => {
		const { db } = testDb();
		const send = vi.fn().mockResolvedValue(undefined);
		await deliverAuthLink(db, { kind: 'magic_link', email: 'a@b.c', url: 'https://x', send });
		expect(send).toHaveBeenCalledWith('a@b.c', 'https://x');
		expect(await db.select().from(outbox)).toHaveLength(1);
	});

	it('keeps the outbox row even if the email sender throws (owner can still forward)', async () => {
		const { db } = testDb();
		const send = vi.fn().mockRejectedValue(new Error('smtp down'));
		await expect(
			deliverAuthLink(db, { kind: 'magic_link', email: 'a@b.c', url: 'https://x', send })
		).resolves.toBeUndefined();
		expect(await db.select().from(outbox)).toHaveLength(1);
	});
});

describe('pendingLinks / markConsumed', () => {
	it('lists unconsumed links newest-first and hides consumed ones', async () => {
		const { db } = testDb();
		await deliverAuthLink(db, { kind: 'magic_link', email: 'one@x', url: 'https://1' });
		await deliverAuthLink(db, { kind: 'magic_link', email: 'two@x', url: 'https://2' });
		const before = await pendingLinks(db);
		expect(before.map((r) => r.recipient)).toEqual(['two@x', 'one@x']);
		await markConsumed(db, before[1]!.id);
		const after = await pendingLinks(db);
		expect(after.map((r) => r.recipient)).toEqual(['two@x']);
	});
});
