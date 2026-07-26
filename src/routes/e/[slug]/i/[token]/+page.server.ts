import { fail } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { loadInvitationPage } from '$lib/server/services/events';
import { submitRsvp, type RsvpError } from '$lib/server/services/rsvp';
import { rateLimit } from '$lib/server/ratelimit';
import { verifyTurnstile } from '$lib/server/turnstile';
import { isLang, pickLang, LANGS, type Lang } from '$lib/i18n';
import type { Actions, PageServerLoad } from './$types';

// Personalized-but-stable: each token URL is one cache entry at the edge, so
// the WhatsApp blast never reaches D1 (spec §4.7). Language is deterministic
// per URL (?lang or card override or event default) — never Accept-Language,
// which CDN caches ignore for HTML.
const CACHE_HEADER = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

export const load: PageServerLoad = async ({ params, platform, setHeaders, url, request }) => {
	const db = getDb(platform!.env.DB);
	const data = await loadInvitationPage(db, params.slug, params.token);

	if (!data) {
		setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
		const accept = request.headers.get('accept-language');
		return { invalid: true as const, lang: pickLang(null, [...LANGS], accept) };
	}

	const supported = data.event.languages.filter(isLang);
	const urlLang = url.searchParams.get('lang');
	const lang: Lang =
		isLang(urlLang) && supported.includes(urlLang)
			? urlLang
			: isLang(data.invitation.lang)
				? data.invitation.lang
				: (supported[0] ?? 'en');

	setHeaders({ 'cache-control': CACHE_HEADER, 'x-robots-tag': 'noindex' });

	const titles: Record<Lang, string | null> = {
		ar: data.event.titleAr,
		fr: data.event.titleFr,
		en: data.event.titleEn
	};
	const pageTitle =
		titles[lang] ?? data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? 'Invitation';
	const ogDescription = new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
		weekday: 'long',
		day: 'numeric',
		month: 'long',
		year: 'numeric'
	}).format(new Date(data.event.dateMain));

	return {
		invalid: false as const,
		lang,
		languages: supported,
		pageTitle,
		ogDescription,
		event: data.event,
		theme: data.theme,
		locations: data.locations,
		invitation: data.invitation,
		musicUrl: data.theme.musicKey ? `/api/media/${data.theme.musicKey}` : null,
		turnstileSiteKey: env.PUBLIC_TURNSTILE_SITE_KEY || null
	};
};

const RsvpFormSchema = z.object({
	attending: z.enum(['yes', 'no']),
	seats: z.coerce.number().int().min(0).max(99).default(0),
	note: z.string().max(500).optional().default(''),
	'cf-turnstile-response': z.string().optional()
});

const ERROR_KEYS: Record<RsvpError, string> = {
	not_found: 'errors.invalid',
	revoked: 'errors.invalid',
	not_live: 'errors.invalid',
	seats_exceed_allowance: 'errors.seats',
	invalid: 'errors.generic'
};

export const actions: Actions = {
	rsvp: async (event) => {
		const db = getDb(event.platform!.env.DB);
		const parsed = RsvpFormSchema.safeParse(Object.fromEntries(await event.request.formData()));
		if (!parsed.success) return fail(400, { errorKey: 'errors.generic' });

		let ip = 'unknown';
		try {
			ip = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
		} catch {
			// keep 'unknown' — the per-token limit still applies
		}

		const ipLimit = await rateLimit(db, `rsvp:ip:${ip}`, { limit: 30, windowSec: 3600 });
		const tokenLimit = await rateLimit(db, `rsvp:tok:${event.params.token}`, {
			limit: 10,
			windowSec: 3600
		});
		if (!ipLimit.allowed || !tokenLimit.allowed) {
			return fail(429, { errorKey: 'errors.rate_limited' });
		}

		const turnstile = await verifyTurnstile(
			env.TURNSTILE_SECRET,
			parsed.data['cf-turnstile-response'] ?? null,
			ip
		);
		if (!turnstile.ok) return fail(400, { errorKey: 'errors.turnstile' });

		const result = await submitRsvp(db, {
			token: event.params.token,
			attending: parsed.data.attending === 'yes',
			seats: parsed.data.seats,
			note: parsed.data.note || null
		});
		if (!result.ok) return fail(400, { errorKey: ERROR_KEYS[result.error] });
		return { success: true, rsvp: result.rsvp };
	}
};
