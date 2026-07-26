import { error } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { events } from '$lib/server/db/schema';
import { requireEventAccess } from '$lib/server/guards';
import { eventStats, rsvpRows, type RsvpStatus } from '$lib/server/services/export';
import { isLang, type Lang } from '$lib/i18n';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, platform, locals, url, setHeaders }) => {
	const db = getDb(platform!.env.DB);
	await requireEventAccess(db, locals, params.event);
	setHeaders({ 'cache-control': 'no-store' });

	const [event] = await db.select().from(events).where(eq(events.id, params.event)).limit(1);
	if (!event) throw error(404, 'no such event');

	const statusParam = url.searchParams.get('status');
	const status: RsvpStatus | undefined =
		statusParam === 'confirmed' || statusParam === 'declined' || statusParam === 'pending'
			? statusParam
			: undefined;
	const q = url.searchParams.get('q')?.trim() || undefined;

	const supported = event.languages.filter(isLang);
	const urlLang = url.searchParams.get('lang');
	const lang: Lang =
		isLang(urlLang) && supported.includes(urlLang) ? urlLang : (supported[0] ?? 'en');

	return {
		lang,
		languages: supported,
		event: {
			id: event.id,
			slug: event.slug,
			titleEn: event.titleEn,
			titleAr: event.titleAr,
			titleFr: event.titleFr,
			dateMain: event.dateMain
		},
		stats: await eventStats(db, event.id),
		rows: await rsvpRows(db, event.id, { status, q }),
		filter: { status: status ?? 'all', q: q ?? '' }
	};
};
