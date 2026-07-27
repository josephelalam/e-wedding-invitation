import { parseTheme, type Theme } from './schema';

/**
 * One-tap wedding palettes (studio → Theme → presets). Colors only — fonts and
 * layout come from the defaults so every preset speaks the same stationery
 * language: a quiet ground, near-black ink, one metallic-leaning accent.
 */
export const presets: Record<string, Theme> = {
	classic: parseTheme({ preset: 'classic' }),
	midnight: parseTheme({
		preset: 'midnight',
		colors: { bg: '#16130f', text: '#f5efe6', accent: '#d4b48a', muted: '#9c937f' }
	}),
	olive: parseTheme({
		preset: 'olive',
		colors: { bg: '#f6f7f2', text: '#272b21', accent: '#7d8a5c', muted: '#8b9080' }
	}),
	burgundy: parseTheme({
		preset: 'burgundy',
		colors: { bg: '#faf6f2', text: '#33211e', accent: '#8e3b3f', muted: '#9a837d' }
	}),
	blush: parseTheme({
		preset: 'blush',
		colors: { bg: '#fbf6f3', text: '#3a2c26', accent: '#c88f7d', muted: '#a18b81' }
	})
};
