import type { Lang } from '$lib/i18n';
import type { LocalizedText } from '$lib/types';

/** Per-language text with graceful fallback to whichever language the owner filled. */
export function resolveText(localized: LocalizedText | undefined, lang: Lang): string | null {
	if (!localized) return null;
	return localized[lang] ?? localized.en ?? localized.fr ?? localized.ar ?? null;
}

export function mediaUrl(key: string): string {
	return `/api/media/${key}`;
}

/** True once the (owner-set, optional) RSVP deadline day has fully passed. */
export function rsvpClosed(deadline: string | null, now = new Date()): boolean {
	if (!deadline) return false;
	const end = new Date(`${deadline.slice(0, 10)}T23:59:59`);
	return now.getTime() > end.getTime();
}
