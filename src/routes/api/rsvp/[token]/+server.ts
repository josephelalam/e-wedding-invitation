import { json } from '@sveltejs/kit';
import { z } from 'zod';
import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { getRsvpState, submitRsvp } from '$lib/server/services/rsvp';
import { rateLimit } from '$lib/server/ratelimit';
import { verifyTurnstile } from '$lib/server/turnstile';
import type { RequestHandler } from './$types';

// The spec's public REST surface (§4.6): GET powers client-side hydration of
// cached pages; POST is the contract a future door check-in PWA reuses.

export const GET: RequestHandler = async ({ params, platform, setHeaders }) => {
	const db = getDb(platform!.env.DB);
	const state = await getRsvpState(db, params.token);
	setHeaders({ 'cache-control': 'no-store' });
	if (!state) return json({ error: 'not_found' }, { status: 404 });
	return json(state);
};

const PostSchema = z.object({
	attending: z.boolean(),
	seats: z.number().int().min(0).max(99).default(0),
	note: z.string().max(500).nullish(),
	turnstileToken: z.string().nullish()
});

export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform!.env.DB);
	let body: unknown;
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'invalid' }, { status: 400 });
	}
	const parsed = PostSchema.safeParse(body);
	if (!parsed.success) return json({ error: 'invalid' }, { status: 400 });

	let ip = 'unknown';
	try {
		ip = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
	} catch {
		// keep 'unknown'
	}
	const ipLimit = await rateLimit(db, `rsvp:ip:${ip}`, { limit: 30, windowSec: 3600 });
	const tokenLimit = await rateLimit(db, `rsvp:tok:${event.params.token}`, {
		limit: 10,
		windowSec: 3600
	});
	if (!ipLimit.allowed || !tokenLimit.allowed) {
		return json({ error: 'rate_limited' }, { status: 429 });
	}

	const turnstile = await verifyTurnstile(
		env.TURNSTILE_SECRET,
		parsed.data.turnstileToken ?? null,
		ip
	);
	if (!turnstile.ok) return json({ error: 'turnstile' }, { status: 400 });

	const result = await submitRsvp(db, {
		token: event.params.token,
		attending: parsed.data.attending,
		seats: parsed.data.seats,
		note: parsed.data.note ?? null
	});
	if (!result.ok) {
		const status = result.error === 'not_found' ? 404 : 400;
		return json({ error: result.error }, { status });
	}
	return json({ ok: true, rsvp: result.rsvp });
};
