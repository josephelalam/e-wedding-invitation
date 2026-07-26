import { describe, it, expect, beforeEach } from 'vitest';
import { testDb, type TestDb } from '../helpers/db';
import { makeEvent } from '../helpers/fixtures';
import { requireOwner, requireEventAccess } from '../../src/lib/server/guards';
import { createOwner, createCoupleUser, ownerExists } from '../../src/lib/server/services/users';
import { user, couples } from '../../src/lib/server/db/schema';
import { eq } from 'drizzle-orm';

function statusOf(fn: () => unknown): number | undefined {
	try {
		fn();
	} catch (err) {
		return (err as { status?: number }).status;
	}
	return undefined;
}

async function statusOfAsync(fn: () => Promise<unknown>): Promise<number | undefined> {
	try {
		await fn();
	} catch (err) {
		return (err as { status?: number }).status;
	}
	return undefined;
}

describe('requireOwner', () => {
	it('throws 403 without a session', () => {
		expect(statusOf(() => requireOwner({}))).toBe(403);
	});

	it('throws 403 for a couple', () => {
		expect(statusOf(() => requireOwner({ user: { id: 'u1', role: 'couple' } }))).toBe(403);
	});

	it('returns the user for the owner', () => {
		expect(requireOwner({ user: { id: 'u1', role: 'owner' } }).id).toBe('u1');
	});
});

describe('requireEventAccess (tenant isolation, spec §7.2)', () => {
	let db: TestDb;

	beforeEach(async () => {
		db = testDb().db;
		await makeEvent(db, { id: 'ev_a', slug: 'a' });
		await makeEvent(db, { id: 'ev_b', slug: 'b' });
	});

	it('throws 403 without a session', async () => {
		expect(await statusOfAsync(() => requireEventAccess(db, {}, 'ev_a'))).toBe(403);
	});

	it('lets the owner into any event', async () => {
		const u = await requireEventAccess(db, { user: { id: 'u0', role: 'owner' } }, 'ev_a');
		expect(u.id).toBe('u0');
	});

	it('lets a couple into their own event only — cross-tenant is 403', async () => {
		const { userId } = await createCoupleUser(db, {
			email: 'couple@x.com',
			name: 'Elie & Maya',
			eventId: 'ev_a'
		});
		const locals = { user: { id: userId, role: 'couple' } };
		expect((await requireEventAccess(db, locals, 'ev_a')).id).toBe(userId);
		expect(await statusOfAsync(() => requireEventAccess(db, locals, 'ev_b'))).toBe(403);
	});
});

describe('user provisioning (managed model — no public signup)', () => {
	let db: TestDb;

	beforeEach(() => {
		db = testDb().db;
	});

	it('creates the single owner with a password credential', async () => {
		expect(await ownerExists(db)).toBe(false);
		const { userId } = await createOwner(db, {
			email: 'owner@rams.services',
			name: 'Joseph',
			password: 'a strong passphrase'
		});
		expect(await ownerExists(db)).toBe(true);
		const [row] = await db.select().from(user).where(eq(user.id, userId));
		expect(row).toMatchObject({ role: 'owner', emailVerified: true });
	});

	it('refuses a second owner', async () => {
		await createOwner(db, { email: 'a@x.com', name: 'A', password: 'pw12345678' });
		await expect(
			createOwner(db, { email: 'b@x.com', name: 'B', password: 'pw12345678' })
		).rejects.toThrow(/owner_exists/);
	});

	it('creates a couple user linked to their event', async () => {
		await makeEvent(db, { id: 'ev_a', slug: 'a' });
		const { userId } = await createCoupleUser(db, {
			email: 'c@x.com',
			name: 'Elie & Maya',
			eventId: 'ev_a'
		});
		const links = await db.select().from(couples);
		expect(links).toEqual([{ userId, eventId: 'ev_a' }]);
	});

	it('reuses an existing couple account for a second event instead of duplicating', async () => {
		await makeEvent(db, { id: 'ev_a', slug: 'a' });
		await makeEvent(db, { id: 'ev_b', slug: 'b' });
		const first = await createCoupleUser(db, { email: 'c@x.com', name: 'C', eventId: 'ev_a' });
		const second = await createCoupleUser(db, { email: 'c@x.com', name: 'C', eventId: 'ev_b' });
		expect(second.userId).toBe(first.userId);
		expect(await db.select().from(user)).toHaveLength(1);
		expect(await db.select().from(couples)).toHaveLength(2);
	});
});
