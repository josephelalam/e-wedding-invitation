import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Magic-link landing page: crawlers and chat-app link previews fetch THIS
// page (harmless GET); only the human's button tap opens the single-use
// verify URL. Same-origin auth paths only — never an open redirect.
export const load: PageServerLoad = async ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
	const raw = url.searchParams.get('u') ?? '';
	let target: URL;
	try {
		target = new URL(raw);
	} catch {
		throw error(404, 'not found');
	}
	if (target.origin !== url.origin || !target.pathname.startsWith('/api/auth/')) {
		throw error(404, 'not found');
	}
	return { target: target.toString() };
};
