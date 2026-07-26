import { fail } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { events, locations } from '$lib/server/db/schema';
import { upsertLocation, deleteLocation } from '$lib/server/services/events';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform }) => {
	const db = getDb(platform!.env.DB);
	const rows = await db
		.select()
		.from(locations)
		.where(eq(locations.eventId, params.id))
		.orderBy(asc(locations.sort), asc(locations.startsAt));
	return { locations: rows };
};

export const actions: Actions = {
	save: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();

		// Stops default to the event's own day: the owner only picks a time
		// (a "different day" date is the exception, e.g. a next-day brunch).
		const time = String(form.get('startsTime') ?? '').trim();
		const dayOverride = String(form.get('startsDate') ?? '').trim();
		let startsAt: string | null = null;
		if (time) {
			let day = dayOverride;
			if (!day) {
				const [event] = await db
					.select({ dateMain: events.dateMain })
					.from(events)
					.where(eq(events.id, params.id))
					.limit(1);
				day = event?.dateMain.slice(0, 10) ?? '';
			}
			startsAt = day ? `${day}T${time}` : null;
		}

		const result = await upsertLocation(
			db,
			params.id,
			{
				id: String(form.get('id') ?? '') || undefined,
				kind: String(form.get('kind') ?? ''),
				labelEn: String(form.get('labelEn') ?? '') || null,
				labelAr: String(form.get('labelAr') ?? '') || null,
				labelFr: String(form.get('labelFr') ?? '') || null,
				mapsUrl: String(form.get('mapsUrl') ?? ''),
				startsAt: startsAt ?? '',
				sort: Number(form.get('sort') ?? 0)
			},
			`owner:${locals.user!.id}`
		);
		if (!result.ok)
			return fail(400, { error: 'Check the stop: kind and a valid URL are required.' });
		return { saved: true };
	},
	remove: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const id = String((await request.formData()).get('id') ?? '');
		if (id) await deleteLocation(db, params.id, id, `owner:${locals.user!.id}`);
		return { saved: true };
	}
};
