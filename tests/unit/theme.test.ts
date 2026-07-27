import { describe, it, expect } from 'vitest';
import { parseTheme, ThemeSchema, DEFAULT_SLIDE_ORDER } from '../../src/lib/themes/schema';
import { presets } from '../../src/lib/themes/presets';

describe('parseTheme', () => {
	it('fills complete defaults from an empty object', () => {
		const theme = parseTheme({});
		expect(theme.preset).toBe('classic');
		expect(theme.colors.bg).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(theme.colors.text).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(theme.colors.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(theme.colors.muted).toMatch(/^#[0-9a-fA-F]{6}$/);
		expect(theme.fonts.display.length).toBeGreaterThan(0);
		expect(theme.fonts.body.length).toBeGreaterThan(0);
		expect(theme.slideOrder).toEqual(DEFAULT_SLIDE_ORDER);
		expect(theme.musicKey).toBeNull();
		expect(theme.monogram).toBeNull();
	});

	it('accepts null/undefined as empty (D1 JSON column may be null)', () => {
		expect(parseTheme(null).preset).toBe('classic');
		expect(parseTheme(undefined).preset).toBe('classic');
	});

	it('merges partial overrides over defaults', () => {
		const theme = parseTheme({ colors: { accent: '#ff0000' } });
		expect(theme.colors.accent).toBe('#ff0000');
		expect(theme.colors.bg).toBe(parseTheme({}).colors.bg);
	});

	it('keeps a custom slide order and music key', () => {
		const theme = parseTheme({ slideOrder: ['hero', 'rsvp'], musicKey: 'audio/ev1.mp3' });
		expect(theme.slideOrder).toEqual(['hero', 'rsvp']);
		expect(theme.musicKey).toBe('audio/ev1.mp3');
	});

	it('rejects unknown slide ids', () => {
		expect(() => parseTheme({ slideOrder: ['hero', 'selfie-wall'] })).toThrow();
	});

	it('rejects duplicate slide ids', () => {
		expect(() => parseTheme({ slideOrder: ['hero', 'hero'] })).toThrow();
	});

	it('rejects an empty slide order', () => {
		expect(() => parseTheme({ slideOrder: [] })).toThrow();
	});

	it('rejects malformed colors', () => {
		expect(() => parseTheme({ colors: { accent: 'red' } })).toThrow();
	});

	it('carries localized text overrides', () => {
		const theme = parseTheme({ texts: { closing: { ar: 'بمحبة', fr: 'Avec amour' } } });
		expect(theme.texts.closing?.ar).toBe('بمحبة');
		expect(theme.texts.closing?.en).toBeUndefined();
	});
});

describe('template module system', () => {
	it('defaults existing/old themes to the slides template', () => {
		expect(parseTheme({}).template).toBe('slides');
		expect(parseTheme({ colors: { accent: '#ff0000' } }).template).toBe('slides');
	});

	it('accepts every registered template id and rejects unknown ones', () => {
		expect(parseTheme({ template: 'edges' }).template).toBe('edges');
		expect(parseTheme({ template: 'cinematic' }).template).toBe('cinematic');
		expect(() => parseTheme({ template: 'tiktok' })).toThrow();
	});

	it('carries owner-placed image keys (no upload UI — hard constraint #1)', () => {
		const theme = parseTheme({ images: ['theme/ev1/1.jpg', 'theme/ev1/2.jpg'] });
		expect(theme.images).toEqual(['theme/ev1/1.jpg', 'theme/ev1/2.jpg']);
		expect(parseTheme({}).images).toEqual([]);
	});

	it('rejects non-R2-key image entries (absolute URLs would break CSP)', () => {
		expect(() => parseTheme({ images: ['https://evil.example/x.jpg'] })).toThrow();
	});

	it('carries the gift account and background video key, defaulting to null', () => {
		const theme = parseTheme({
			giftsAccountLabel: 'Whish Money',
			giftsAccount: '03 123 456',
			videoKey: 'theme/ev1/bg.mp4'
		});
		expect(theme.giftsAccountLabel).toBe('Whish Money');
		expect(theme.giftsAccount).toBe('03 123 456');
		expect(theme.videoKey).toBe('theme/ev1/bg.mp4');
		expect(parseTheme({}).giftsAccount).toBeNull();
		expect(parseTheme({}).giftsAccountLabel).toBeNull();
		expect(parseTheme({}).videoKey).toBeNull();
	});

	it('rejects a background video outside theme/ (CSP media-src is self)', () => {
		expect(() => parseTheme({ videoKey: 'https://evil.example/x.mp4' })).toThrow();
	});

	it('carries the ambient effect, defaulting to none, rejecting unknown kinds', () => {
		expect(parseTheme({}).effect).toBe('none');
		expect(parseTheme({ effect: 'sparkles' }).effect).toBe('sparkles');
		expect(() => parseTheme({ effect: 'confetti-cannon' })).toThrow();
	});

	it('carries the extended template texts and rsvp deadline', () => {
		const theme = parseTheme({
			rsvpDeadline: '2026-09-01',
			texts: {
				intro: { ar: 'إِذًا لَيْسَا بَعْدُ اثْنَيْنِ' },
				parents: { en: 'Mr. & Mrs. Karam · Mr. & Mrs. Aoun' },
				gifts: { en: 'Your presence is the greatest gift.' },
				endCaption: { ar: 'و ابتدا المشوار...' }
			}
		});
		expect(theme.rsvpDeadline).toBe('2026-09-01');
		expect(theme.texts.intro?.ar).toContain('اثْنَيْنِ');
		expect(theme.texts.endCaption?.ar).toBe('و ابتدا المشوار...');
		expect(parseTheme({}).rsvpDeadline).toBeNull();
	});
});

describe('presets', () => {
	it('ships classic and midnight, both valid', () => {
		expect(Object.keys(presets)).toEqual(expect.arrayContaining(['classic', 'midnight']));
		for (const preset of Object.values(presets)) {
			expect(ThemeSchema.safeParse(preset).success).toBe(true);
		}
	});

	it('presets are visually distinct (different palettes)', () => {
		expect(presets.classic!.colors.bg).not.toBe(presets.midnight!.colors.bg);
	});
});
