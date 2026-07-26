import { eq } from 'drizzle-orm';
import type { Db } from '../db';
import { user, account, couples } from '../db/schema';
import { newId, pbkdf2Hash } from '../crypto';
import { audit } from './audit';

// Managed model: no public sign-up path exists. The owner is created once by
// the SETUP_TOKEN-gated bootstrap; couples are created by the owner. Rows are
// written in better-auth's shape so its sign-in flows pick them up.

export async function ownerExists(db: Db): Promise<boolean> {
	const [row] = await db.select({ id: user.id }).from(user).where(eq(user.role, 'owner')).limit(1);
	return row !== undefined;
}

export async function createOwner(
	db: Db,
	input: { email: string; name: string; password: string }
): Promise<{ userId: string }> {
	if (await ownerExists(db)) throw new Error('owner_exists');
	const userId = newId();
	const now = new Date();
	await db.insert(user).values({
		id: userId,
		email: input.email.toLowerCase(),
		name: input.name,
		emailVerified: true,
		role: 'owner',
		createdAt: now,
		updatedAt: now
	});
	await db.insert(account).values({
		id: newId(),
		userId,
		providerId: 'credential',
		accountId: userId,
		password: await pbkdf2Hash(input.password),
		createdAt: now,
		updatedAt: now
	});
	await audit(db, 'system', 'owner.create', 'user', userId);
	return { userId };
}

export async function createCoupleUser(
	db: Db,
	input: { email: string; name: string; eventId: string }
): Promise<{ userId: string }> {
	const email = input.email.toLowerCase();
	const [existing] = await db
		.select({ id: user.id })
		.from(user)
		.where(eq(user.email, email))
		.limit(1);
	let userId = existing?.id;
	const now = new Date();
	if (!userId) {
		userId = newId();
		await db.insert(user).values({
			id: userId,
			email,
			name: input.name,
			emailVerified: true,
			role: 'couple',
			createdAt: now,
			updatedAt: now
		});
	}
	await db
		.insert(couples)
		.values({ userId, eventId: input.eventId })
		.onConflictDoNothing({ target: [couples.userId, couples.eventId] });
	await audit(db, 'owner', 'couple.link', 'event', input.eventId, { userId });
	return { userId };
}
