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
