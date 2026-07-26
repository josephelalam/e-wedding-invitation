import { redirect } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { couples } from '$lib/server/db/schema';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, platform }) => {
	if (!locals.user) redirect(303, '/dash/login');
	const db = getDb(platform!.env.DB);
	const links = await db
		.select({ eventId: couples.eventId })
		.from(couples)
		.where(eq(couples.userId, locals.user.id));
	if (links.length === 0 && locals.user.role !== 'owner') redirect(303, '/dash/login?none=1');
	if (links.length >= 1) redirect(303, `/dash/${links[0]!.eventId}`);
	redirect(303, '/studio');
};
