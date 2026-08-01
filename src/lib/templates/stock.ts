import type { TemplateId } from '$lib/themes/schema';
import type { Theme } from '$lib/themes/schema';
import { mediaUrl } from './context';

/**
 * Bundled stock photography (static/photos, Pexels license — free commercial
 * use, no attribution). Deliberately anonymous shots only (backs, hands,
 * rings, tables, distant silhouettes): a real couple's invitation must never
 * show a recognizable stranger. Owner-placed R2 keys always win — these are
 * the "looks finished on day one" fallback, per template mood.
 */
export const STOCK_SETS: Record<TemplateId, string[]> = {
	slides: [
		'/photos/field-walk.jpg',
		'/photos/hands-couple.jpg',
		'/photos/rings-bokeh.jpg',
		'/photos/table-lights.jpg',
		'/photos/rings-veil.jpg'
	],
	edges: [
		'/photos/field-walk.jpg',
		'/photos/rings-veil.jpg',
		'/photos/table-bright.jpg',
		'/photos/rings-pleats.jpg',
		'/photos/hands-couple.jpg'
	],
	cinematic: ['/photos/beach-sunset.jpg', '/photos/chandelier.jpg', '/photos/rings-bokeh.jpg'],
	depth: [
		'/photos/field-walk.jpg',
		'/photos/chandelier.jpg',
		'/photos/rings-pleats.jpg',
		'/photos/table-lights.jpg',
		'/photos/beach-sunset.jpg'
	]
};

/** Owner photos when set, else the template's curated stock set. */
export function resolveImageUrls(theme: Theme): string[] {
	if (theme.images.length > 0) return theme.images.map(mediaUrl);
	return STOCK_SETS[theme.template] ?? [];
}
