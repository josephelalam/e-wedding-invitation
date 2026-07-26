import { error } from '@sveltejs/kit';
import { and, eq } from 'drizzle-orm';
import type { Db } from './db';
import { couples } from './db/schema';

export type SessionUser = { id: string; role?: string | null };
type MaybeLocals = { user?: SessionUser | null };

/** Owner studio gate. 403, never 404 leaks: the studio's existence is not a secret, its data is. */
export function requireOwner(locals: MaybeLocals): SessionUser {
	const user = locals.user;
	if (!user || user.role !== 'owner') throw error(403, 'forbidden');
	return user;
}

/**
 * Tenant isolation (spec §7.2): event scope always derives from the session
 * server-side. Owners see everything; couples only events they are linked to.
 */
export async function requireEventAccess(
	db: Db,
	locals: MaybeLocals,
	eventId: string
): Promise<SessionUser> {
	const user = locals.user;
	if (!user) throw error(403, 'forbidden');
	if (user.role === 'owner') return user;
	const [link] = await db
		.select({ eventId: couples.eventId })
		.from(couples)
		.where(and(eq(couples.userId, user.id), eq(couples.eventId, eventId)))
		.limit(1);
	if (!link) throw error(403, 'forbidden');
	return user;
}
