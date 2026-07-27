import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { STOCK_SETS, resolveImageUrls } from '../../src/lib/templates/stock';
import { parseTheme, TEMPLATE_IDS } from '../../src/lib/themes/schema';

describe('stock photography fallback', () => {
	it('every template has a curated stock set', () => {
		for (const id of TEMPLATE_IDS) {
			expect(STOCK_SETS[id].length, `${id} stock set`).toBeGreaterThanOrEqual(3);
		}
	});

	it('every stock path points at a real bundled file', () => {
		const bundled = new Set(readdirSync(join(import.meta.dirname, '../../static/photos')));
		for (const set of Object.values(STOCK_SETS)) {
			for (const url of set) {
				expect(url).toMatch(/^\/photos\/[a-z0-9-]+\.jpg$/);
				expect(bundled.has(url.replace('/photos/', '')), `${url} exists`).toBe(true);
			}
		}
	});

	it('owner-placed R2 keys always win over stock', () => {
		const theme = parseTheme({ template: 'edges', images: ['theme/ev1/1.jpg'] });
		expect(resolveImageUrls(theme)).toEqual(['/api/media/theme/ev1/1.jpg']);
	});

	it('an empty theme falls back to the template stock set', () => {
		const theme = parseTheme({ template: 'cinematic' });
		expect(resolveImageUrls(theme)).toEqual(STOCK_SETS.cinematic);
	});
});
