import { parseTheme, type Theme } from './schema';

/** The spec's two launch presets (§10 Phase 1). A wedding is a row + one of these + overrides. */
export const presets: Record<string, Theme> = {
	classic: parseTheme({ preset: 'classic' }),
	midnight: parseTheme({
		preset: 'midnight',
		colors: { bg: '#141221', text: '#f4efe9', accent: '#d4af6a', muted: '#8d89a3' }
	})
};
