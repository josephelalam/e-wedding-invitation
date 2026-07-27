import { error } from '@sveltejs/kit';
import { asc, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { events, locations } from '$lib/server/db/schema';
import { requireOwner } from '$lib/server/guards';
import { parseTheme, DEFAULT_THEME, TEMPLATE_IDS, type TemplateId } from '$lib/themes/schema';
import { isLang, type Lang } from '$lib/i18n';
import type { PageServerLoad } from './$types';

// Owner-only draft preview (also embedded by the studio theme editor).
// Bypasses the edge cache and works for any event status.
export const load: PageServerLoad = async ({ params, platform, locals, url, setHeaders }) => {
	requireOwner(locals);
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });

	const db = getDb(platform!.env.DB);
	const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1);
	if (!event) throw error(404, 'no such event');

	let theme;
	try {
		theme = parseTheme(event.theme);
	} catch {
		theme = DEFAULT_THEME;
	}

	// The studio picker previews a layout switch instantly, before saving.
	const templateOverride = url.searchParams.get('template');
	if (templateOverride && (TEMPLATE_IDS as readonly string[]).includes(templateOverride)) {
		theme = { ...theme, template: templateOverride as TemplateId };
	}

	const supported = event.languages.filter(isLang);
	const urlLang = url.searchParams.get('lang');
	const lang: Lang =
		isLang(urlLang) && supported.includes(urlLang) ? urlLang : (supported[0] ?? 'en');

	const locationRows = await db
		.select()
		.from(locations)
		.where(eq(locations.eventId, event.id))
		.orderBy(asc(locations.sort), asc(locations.startsAt));

	return {
		lang,
		languages: supported,
		event: {
			slug: event.slug,
			type: event.type,
			titleEn: event.titleEn,
			titleAr: event.titleAr,
			titleFr: event.titleFr,
			dateMain: event.dateMain,
			datesExtra: event.datesExtra ?? []
		},
		theme,
		locations: locationRows,
		invitation: { guestLabel: 'Elie & Maya Karam', maxSeats: 2, lang: null },
		musicUrl: theme.musicKey ? `/api/media/${theme.musicKey}` : null,
		turnstileSiteKey: null
	};
};
