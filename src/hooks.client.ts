import type { HandleClientError } from '@sveltejs/kit';

// Client-side capture without shipping an SDK: a beacon to our own /api/log,
// which forwards to Sentry when configured (spec §4.13, bundle-weight §4.1).
export const handleError: HandleClientError = ({ error, status }) => {
	if (status !== 404) {
		try {
			const payload = JSON.stringify({
				message: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
				url: location.pathname
			}).slice(0, 1024);
			navigator.sendBeacon?.('/api/log', payload);
		} catch {
			// reporting must never break the page
		}
	}
	return { message: 'internal error' };
};
