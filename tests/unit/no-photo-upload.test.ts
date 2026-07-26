import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Hard constraint #1 (owner-mandated): no photo uploading anywhere in the MVP.
// The ONLY file input in the whole codebase is the event's audio track.

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

const SRC = join(import.meta.dirname, '../../src');

describe('hard constraint #1 — no photo uploading', () => {
	const fileInputs = walk(SRC)
		.filter((path) => path.endsWith('.svelte'))
		.flatMap((path) => {
			const source = readFileSync(path, 'utf8');
			return source.includes('type="file"') || source.includes("type='file'")
				? [{ path, source }]
				: [];
		});

	it('exactly one file input exists in the entire app', () => {
		expect(fileInputs.map((f) => f.path.replace(SRC, 'src'))).toEqual([
			'src/routes/studio/(app)/events/[id]/audio/+page.svelte'
		]);
	});

	it('and it accepts audio only', () => {
		const inputTag = /<input[^>]*type="file"[^>]*>/.exec(fileInputs[0]?.source ?? '');
		expect(inputTag?.[0]).toContain('accept="audio/*"');
	});

	it('no server code accepts image uploads (serving owner-placed images is spec-allowed §4.9)', () => {
		for (const path of walk(SRC).filter((p) => p.endsWith('.ts'))) {
			const source = readFileSync(path, 'utf8');
			const handlesUploads = source.includes('.formData()') && source.includes('instanceof File');
			if (handlesUploads) {
				expect(source.includes("'image/"), `${path} must not accept image uploads`).toBe(false);
				expect(/accept.*image/i.test(source), `${path} must not accept image uploads`).toBe(false);
			}
		}
	});
});
