import { fail, redirect } from '@sveltejs/kit';
import { desc } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { createEvent } from '$lib/server/services/events';
import { eventStats } from '$lib/server/services/export';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform }) => {
	const db = getDb(platform!.env.DB);
	const rows = await db.select().from(events).orderBy(desc(events.dateMain));
	const withStats = await Promise.all(
		rows.map(async (event) => ({
			id: event.id,
			slug: event.slug,
			title: event.titleEn ?? event.titleFr ?? event.titleAr ?? event.slug,
			type: event.type,
			dateMain: event.dateMain,
			status: event.status,
			paymentStatus: event.paymentStatus,
			stats: await eventStats(db, event.id)
		}))
	);
	return { events: withStats };
};

export const actions: Actions = {
	create: async ({ platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();
		const languages = form.getAll('languages').map(String);
		const result = await createEvent(
			db,
			{
				slug: String(form.get('slug') ?? ''),
				type: String(form.get('type') || 'wedding'),
				titleEn: String(form.get('titleEn') ?? '') || null,
				titleAr: String(form.get('titleAr') ?? '') || null,
				titleFr: String(form.get('titleFr') ?? '') || null,
				dateMain: String(form.get('dateMain') ?? ''),
				languages
			},
			`owner:${locals.user!.id}`
		);
		if (!result.ok) {
			return fail(400, {
				error:
					result.error === 'slug_taken'
						? 'That link name is already used by another event.'
						: 'Check the form: the link name must be kebab-case, the date is required, and at least one language must be selected.'
			});
		}
		redirect(303, `/studio/events/${result.event.id}`);
	}
};
