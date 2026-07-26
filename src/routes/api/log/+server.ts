import { env } from '$env/dynamic/private';
import { getDb } from '$lib/server/db';
import { rateLimit } from '$lib/server/ratelimit';
import { captureError } from '$lib/server/sentry';
import type { RequestHandler } from './$types';

// Beacon target for client-side errors (1 KB cap, rate-limited).
export const POST: RequestHandler = async (event) => {
	const db = getDb(event.platform!.env.DB);
	let ip = 'unknown';
	try {
		ip = event.request.headers.get('cf-connecting-ip') ?? event.getClientAddress();
	} catch {
		// keep 'unknown'
	}
	const limit = await rateLimit(db, `log:${ip}`, { limit: 10, windowSec: 3600 });
	if (!limit.allowed) return new Response(null, { status: 429 });

	const text = (await event.request.text()).slice(0, 1024);
	let message = 'client error';
	let url: string | undefined;
	try {
		const parsed = JSON.parse(text) as { message?: string; url?: string };
		message = String(parsed.message ?? message).slice(0, 500);
		url = parsed.url ? String(parsed.url).slice(0, 200) : undefined;
	} catch {
		message = text.slice(0, 500);
	}
	event.platform?.ctx?.waitUntil?.(
		captureError({ dsn: env.SENTRY_DSN, source: 'client', url }, new Error(message))
	);
	return new Response(null, { status: 204 });
};
