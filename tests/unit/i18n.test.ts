import { describe, it, expect } from 'vitest';
import { t, dirFor, pickLang, LANGS } from '../../src/lib/i18n';
import en from '../../src/lib/i18n/en.json';
import fr from '../../src/lib/i18n/fr.json';
import ar from '../../src/lib/i18n/ar.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
	return Object.entries(obj).flatMap(([k, v]) =>
		v !== null && typeof v === 'object'
			? flattenKeys(v as Record<string, unknown>, `${prefix}${k}.`)
			: [`${prefix}${k}`]
	);
}

describe('translation completeness (spec §4.14 — fails if any key is missing)', () => {
	const reference = flattenKeys(en).sort();

	it.each([
		['fr', fr],
		['ar', ar]
	])('%s has exactly the same keys as en', (_name, dict) => {
		expect(flattenKeys(dict as Record<string, unknown>).sort()).toEqual(reference);
	});

	it('has no empty strings in any language', () => {
		for (const dict of [en, fr, ar]) {
			for (const key of flattenKeys(dict as Record<string, unknown>)) {
				const val = key
					.split('.')
					.reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], dict);
				expect(val, key).toBeTypeOf('string');
				expect((val as string).length, key).toBeGreaterThan(0);
			}
		}
	});
});

describe('t()', () => {
	it('resolves nested keys per language', () => {
		expect(t('en', 'cover.open')).toBe('Open Invitation');
		expect(t('fr', 'cover.open')).toBe("Ouvrir l'invitation");
		expect(t('ar', 'cover.open')).toBe('افتحوا الدعوة');
	});

	it('interpolates {params}', () => {
		expect(t('en', 'cover.dear', { name: 'Elie & Maya' })).toBe('For Elie & Maya');
		expect(t('en', 'rsvp.seats_of', { max: 3 })).toBe('of 3 seats');
	});

	it('returns the key itself when missing (never crashes a wedding page)', () => {
		expect(t('en', 'nope.not.here')).toBe('nope.not.here');
	});
});

describe('dirFor()', () => {
	it('is rtl only for Arabic', () => {
		expect(dirFor('ar')).toBe('rtl');
		expect(dirFor('fr')).toBe('ltr');
		expect(dirFor('en')).toBe('ltr');
	});
});

describe('pickLang()', () => {
	it('exports the supported languages in display order', () => {
		expect(LANGS).toEqual(['ar', 'fr', 'en']);
	});

	it('lets the per-invitation override win absolutely', () => {
		expect(pickLang('ar', ['fr', 'en'], 'en')).toBe('ar');
	});

	it('ignores an invalid invitation lang', () => {
		expect(pickLang('de', ['fr', 'en'], '')).toBe('fr');
	});

	it('matches Accept-Language against the event languages by quality', () => {
		expect(pickLang(null, ['fr', 'ar', 'en'], 'ar-LB,ar;q=0.9,en;q=0.8')).toBe('ar');
		expect(pickLang(null, ['fr', 'en'], 'de-DE,de;q=0.9,en;q=0.5')).toBe('en');
	});

	it('falls back to the event default (first listed)', () => {
		expect(pickLang(null, ['fr', 'en'], 'de-DE')).toBe('fr');
	});

	it('falls back to en when the event has no languages', () => {
		expect(pickLang(null, [], '')).toBe('en');
	});
});
