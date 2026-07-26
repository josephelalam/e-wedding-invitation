import type { Handle, HandleServerError } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { building } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createAuth } from '$lib/server/auth';
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { applySecurityHeaders } from '$lib/server/headers';
import { captureError } from '$lib/server/sentry';

const handleBetterAuth: Handle = async ({ event, resolve }) => {
	if (!event.platform?.env?.DB)
		throw new Error('D1 binding "DB" not found - are you running with wrangler?');

	event.locals.auth = createAuth(event.platform.env.DB);

	const { auth } = event.locals;
	const session = await auth.api.getSession({ headers: event.request.headers });

	if (session) {
		event.locals.session = session.session;
		event.locals.user = session.user;
	}

	return svelteKitHandler({ event, resolve, auth, building });
};

const handleSecurityHeaders: Handle = async ({ event, resolve }) => {
	const response = await resolve(event);
	applySecurityHeaders(response.headers);
	return response;
};

export const handle: Handle = sequence(handleSecurityHeaders, handleBetterAuth);

// Silent RSVP failures are direct business damage (spec §4.13): every
// unexpected server error is reported, without blocking the response.
export const handleError: HandleServerError = async ({ error, event, status }) => {
	if (status !== 404) {
		const report = captureError(
			{ dsn: env.SENTRY_DSN, source: 'server', url: event.url.pathname },
			error
		);
		event.platform?.ctx?.waitUntil?.(report);
	}
	return { message: 'internal error' };
};
