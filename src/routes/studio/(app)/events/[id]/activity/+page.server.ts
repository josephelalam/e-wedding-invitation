import { sql } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import type { PageServerLoad } from './$types';

// The "my aunt swears she RSVP'd" settler (spec §4.13).
export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);
	const rows = (await db.all(
		sql`SELECT actor, action, entity, entity_id AS entityId, at, meta
		    FROM audit_log
		    WHERE (entity = 'event' AND entity_id = ${params.id})
		       OR (entity = 'invitation' AND entity_id IN (SELECT id FROM invitations WHERE event_id = ${params.id}))
		    ORDER BY at DESC
		    LIMIT 200`
	)) as {
		actor: string;
		action: string;
		entity: string;
		entityId: string;
		at: string;
		meta: string | null;
	}[];
	return { activity: rows };
};
