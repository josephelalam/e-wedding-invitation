import en from './en.json';
import fr from './fr.json';
import ar from './ar.json';

export const LANGS = ['ar', 'fr', 'en'] as const;
export type Lang = (typeof LANGS)[number];

const dictionaries: Record<Lang, unknown> = { en, fr, ar };

export function isLang(value: unknown): value is Lang {
	return typeof value === 'string' && (LANGS as readonly string[]).includes(value);
}

/** Dot-path lookup with {param} interpolation. Missing keys return the key — a wedding page must never crash over a translation. */
export function t(lang: Lang, key: string, params?: Record<string, string | number>): string {
	const raw = key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				node !== null && typeof node === 'object'
					? (node as Record<string, unknown>)[part]
					: undefined,
			dictionaries[lang]
		);
	if (typeof raw !== 'string') return key;
	if (!params) return raw;
	return raw.replace(/\{(\w+)\}/g, (match, name: string) =>
		name in params ? String(params[name]) : match
	);
}

export function dirFor(lang: Lang): 'rtl' | 'ltr' {
	return lang === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Language resolution (spec §8): per-invitation override wins absolutely,
 * then the guest's Accept-Language restricted to the event's languages,
 * then the event default (first listed), then English.
 */
export function pickLang(
	invitationLang: string | null | undefined,
	eventLanguages: string[],
	acceptLanguage: string | null | undefined
): Lang {
	if (isLang(invitationLang)) return invitationLang;
	const supported = eventLanguages.filter(isLang);
	const prefs = (acceptLanguage ?? '')
		.split(',')
		.map((part) => {
			const [tag = '', ...rest] = part.trim().split(';');
			const qParam = rest.map((p) => p.trim()).find((p) => p.startsWith('q='));
			const q = qParam ? Number.parseFloat(qParam.slice(2)) : 1;
			return { tag: tag.trim().toLowerCase(), q: Number.isFinite(q) ? q : 0 };
		})
		.filter((p) => p.tag)
		.sort((a, b) => b.q - a.q);
	for (const { tag } of prefs) {
		const base = tag.split('-')[0];
		if (isLang(base) && supported.includes(base)) return base;
	}
	return supported[0] ?? 'en';
}
