import { z } from 'zod';

export const SECTION_IDS = [
	'hero',
	'countdown',
	'locations',
	'schedule',
	'gifts',
	'rsvp',
	'closing'
] as const;
export type SectionId = (typeof SECTION_IDS)[number];
export const DEFAULT_SLIDE_ORDER: readonly SectionId[] = SECTION_IDS;

// The template module system: each id is a full invitation layout under
// src/lib/templates/<id>/ sharing the same data contract. Adding a module =
// new id here + a component in the registry.
export const TEMPLATE_IDS = ['slides', 'edges', 'cinematic'] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected #rrggbb');
const localized = z.object({
	ar: z.string().optional(),
	fr: z.string().optional(),
	en: z.string().optional()
});

// Owner-placed R2 keys only (hard constraint #1: no upload UI; and CSP
// img-src 'self' forbids external URLs anyway).
const imageKey = z.string().regex(/^theme\/[A-Za-z0-9_\-./]+$/, 'expected an R2 key under theme/');

export const ThemeSchema = z.object({
	preset: z.string().min(1),
	template: z.enum(TEMPLATE_IDS),
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
	images: z.array(imageKey).max(12),
	rsvpDeadline: z.string().nullable(),
	texts: z.object({
		welcome: localized.optional(),
		closing: localized.optional(),
		intro: localized.optional(),
		parents: localized.optional(),
		gifts: localized.optional(),
		endCaption: localized.optional()
	})
});

export type Theme = z.infer<typeof ThemeSchema>;

export const DEFAULT_THEME: Theme = {
	preset: 'classic',
	template: 'slides',
	// The house look: ivory / ink / burnished gold — luxury stationery, not a web palette.
	colors: { bg: '#faf7f1', text: '#23201c', accent: '#b8966e', muted: '#8f8577' },
	// Self-hosted subsets (static/fonts + src/lib/styles/fonts.css, OFL): Cormorant
	// carries latin display, Amiri carries Arabic; Jost is the quiet body/UI face.
	fonts: {
		display: "'Cormorant Garamond', 'Amiri', Georgia, 'Noto Naskh Arabic', serif",
		body: "'Jost', system-ui, 'Segoe UI', 'Noto Sans Arabic', sans-serif"
	},
	slideOrder: [...DEFAULT_SLIDE_ORDER],
	musicKey: null,
	monogram: null,
	images: [],
	rsvpDeadline: null,
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
