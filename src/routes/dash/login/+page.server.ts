import { fail } from '@sveltejs/kit';
import { getDb } from '$lib/server/db';
import { rateLimit } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { signedIn: Boolean(locals.user) };
};

export const actions: Actions = {
	send: async (event) => {
		const email = String((await event.request.formData()).get('email') ?? '')
			.trim()
			.toLowerCase();
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(400, { error: 'invalid_email' });

		const db = getDb(event.platform!.env.DB);
		let ip = 'unknown';
		try {
			ip = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
		} catch {
			// keep 'unknown'
		}
		const limit = await rateLimit(db, `magic:${ip}`, { limit: 5, windowSec: 3600 });
		if (!limit.allowed) return fail(429, { error: 'rate_limited' });

		try {
			// disableSignUp is on: unknown emails get no account and no link,
			// but the response is identical — no account enumeration.
			await event.locals.auth.api.signInMagicLink({
				body: { email, callbackURL: '/dash' },
				headers: event.request.headers
			});
		} catch {
			// swallow: same response either way
		}
		return { sent: true };
	}
};
