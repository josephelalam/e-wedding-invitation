import { z } from 'zod';

export const SECTION_IDS = [
	'hero',
	'countdown',
	'locations',
	'schedule',
	'rsvp',
	'closing'
] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export const DEFAULT_SLIDE_ORDER: readonly SectionId[] = SECTION_IDS;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');
const localized = z.object({
	ar: z.string().optional(),
	fr: z.string().optional(),
	en: z.string().optional()
});

export const ThemeSchema = z.object({
	preset: z.string().min(1),
	colors: z.object({ bg: hex, text: hex, accent: hex, muted: hex }),
	// System stacks by default: $0 + CSP 'self' means no font CDN. Hosted
	// subsets can be added under /static/fonts and referenced here.
	fonts: z.object({ display: z.string().min(1), body: z.string().min(1) }),
	slideOrder: z
		.array(z.enum(SECTION_IDS))
		.min(1)
		.refine((arr) => new Set(arr).size === arr.length, 'duplicate slide ids'),
	musicKey: z.string().nullable(),
	monogram: z.string().nullable(),
	texts: z.object({ welcome: localized.optional(), closing: localized.optional() })
});

export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = {
	preset: 'classic',
	colors: { bg: '#faf7f2', text: '#2d2a26', accent: '#a3785f', muted: '#8a857e' },
	fonts: {
		display: "Georgia, 'Palatino Linotype', 'Noto Naskh Arabic', serif",
		body: "system-ui, 'Segoe UI', 'Noto Sans Arabic', sans-serif"
	},
	slideOrder: [...DEFAULT_SLIDE_ORDER],
	musicKey: null,
	monogram: null,
	texts: {}
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, over: unknown): T {
	if (!isPlainObject(base) || !isPlainObject(over)) {
		return (over === undefined ? base : over) as T;
	}
	const out: Record<string, unknown> = { ...base };
	for (const [key, value] of Object.entries(over)) {
		if (value === undefined) continue;
		out[key] = key in base ? deepMerge((base as Record<string, unknown>)[key], value) : value;
	}
	return out as T;
}

/**
 * Theme JSON from D1 (possibly null, partial, or hand-edited) → complete,
 * validated Theme. Unknown keys are dropped; structural mistakes throw so the
 * studio editor can surface them.
 */
export function parseTheme(input: unknown): Theme {
	const merged = deepMerge(DEFAULT_THEME, isPlainObject(input) ? input : {});
	return ThemeSchema.parse(merged);
}
