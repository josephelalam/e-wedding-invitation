import { fail } from '@sveltejs/kit';
import { asc, eq, sql } from 'drizzle-orm';
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

async function eventDate(db: ReturnType<typeof getDb>, eventId: string): Promise<string> {
	const [event] = await db
		.select({ dateMain: events.dateMain })
		.from(events)
		.where(eq(events.id, eventId))
		.limit(1);
	return event?.dateMain ?? '';
}

export const actions: Actions = {
	// One click creates an editable stop pre-filled with the event's own
	// date+time and the next order number (max+1, so deletions never collide).
	add: async ({ params, platform, locals }) => {
		const db = getDb(platform!.env.DB);
		const [row] = (await db.all(
			sql`SELECT COALESCE(MAX(sort), 0) + 1 AS next FROM locations WHERE event_id = ${params.id}`
		)) as { next: number }[];
		const result = await upsertLocation(
			db,
			params.id,
			{
				kind: 'other',
				startsAt: (await eventDate(db, params.id)).slice(0, 16),
				sort: row?.next ?? 1
			},
			`owner:${locals.user!.id}`
		);
		if (!result.ok) return fail(400, { error: 'Could not add a stop — try again.' });
		return { saved: true };
	},
	save: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();

		// Stops default to the event's own day: the owner only picks a time
		// (a "different day" date is the exception, e.g. a next-day brunch).
		const time = String(form.get('startsTime') ?? '').trim();
		const dayOverride = String(form.get('startsDate') ?? '').trim();
		let startsAt: string | null = null;
		if (time) {
			const day = dayOverride || (await eventDate(db, params.id)).slice(0, 10);
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
