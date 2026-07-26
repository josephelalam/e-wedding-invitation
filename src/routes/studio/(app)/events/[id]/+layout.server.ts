import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);
	const [event] = await db.select().from(events).where(eq(events.id, params.id)).limit(1);
	if (!event) throw error(404, 'no such event');
	return { event };
};
