import type { Db } from '../db';
import { auditLog } from '../db/schema';
import { newId } from '../crypto';

/**
 * Append-only trail: settles "my aunt swears she RSVP'd" disputes (spec §4.13).
 * Actors are `owner:<id>`, `couple:<id>`, `guest:<invitationId>` or `system` —
 * never raw tokens.
 */
export async function audit(
	db: Db,
	actor: string,
	action: string,
	entity: string,
	entityId: string,
	meta?: Record<string, unknown>
): Promise<void> {
	await db.insert(auditLog).values({
		id: newId(),
		actor,
		action,
		entity,
		entityId,
		at: new Date().toISOString(),
		meta
	});
}
