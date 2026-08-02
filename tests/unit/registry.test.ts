import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../../src/lib/templates/registry';
import { TEMPLATE_IDS, parseTheme } from '../../src/lib/themes/schema';

describe('template registry', () => {
	it('has an entry for every declared template id', () => {
		for (const id of TEMPLATE_IDS) {
			expect(TEMPLATES[id], `missing registry entry for "${id}"`).toBeDefined();
			expect(TEMPLATES[id].id).toBe(id);
			expect(TEMPLATES[id].name.length).toBeGreaterThan(0);
			expect(TEMPLATES[id].tagline.length).toBeGreaterThan(0);
			expect(TEMPLATES[id].component).toBeDefined();
		}
	});

	it('declares no registry entry without a declared id', () => {
		expect(Object.keys(TEMPLATES).sort()).toEqual([...TEMPLATE_IDS].sort());
	});

	it('accepts depth as a stored template', () => {
		expect(parseTheme({ template: 'depth' }).template).toBe('depth');
	});
});
