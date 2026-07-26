import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { updateEvent, setEventStatus } from '$lib/server/services/events';
import type { Actions } from './$types';

export const actions: Actions = {
	update: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const form = await request.formData();
		const languages = form.getAll('languages').map(String);
		const result = await updateEvent(
			db,
			params.id,
			{
				titleEn: String(form.get('titleEn') ?? '') || null,
				titleAr: String(form.get('titleAr') ?? '') || null,
				titleFr: String(form.get('titleFr') ?? '') || null,
				dateMain: String(form.get('dateMain') ?? ''),
				type: String(form.get('type') || 'wedding'),
				languages,
				paymentStatus: String(form.get('paymentStatus') ?? 'pending') as
					'pending' | 'deposit' | 'paid',
				retentionMonths: Number(form.get('retentionMonths') ?? 6)
			},
			`owner:${locals.user!.id}`
		);
		if (!result.ok) return fail(400, { error: 'Invalid values — nothing was saved.' });
		return { saved: true };
	},
	status: async ({ params, platform, request, locals }) => {
		const db = getDb(platform!.env.DB);
		const to = String((await request.formData()).get('to'));
		if (to !== 'draft' && to !== 'live' && to !== 'archived') {
			return fail(400, { error: 'Unknown status.' });
		}
		const result = await setEventStatus(db, params.id, to, `owner:${locals.user!.id}`);
		if (!result.ok) return fail(400, { error: 'Could not change status.' });
		return { saved: true };
	}
};
