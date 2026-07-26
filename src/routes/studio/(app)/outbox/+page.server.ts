import { getDb } from '$lib/server/db';
import { pendingLinks, markConsumed } from '$lib/server/services/outbox';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!.env.DB);
	return { links: await pendingLinks(db) };
};

export const actions: Actions = {
	consume: async ({ platform, request }) => {
		const db = getDb(platform!.env.DB);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await markConsumed(db, id);
		return { ok: true };
	}
};
