import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Upload policy (owner-revised 2026-07-28, superseding hard constraint #1):
// the OWNER uploads media in the studio — photos and a background video on
// the Theme tab, the audio track on the Music tab. Guests and couples never
// see a file input, and no server code accepts uploads outside the
// owner-guarded studio actions.

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		return statSync(path).isDirectory() ? walk(path) : [path];
	});
}

const SRC = join(import.meta.dirname, '../../src');

describe('upload policy — media uploads are a studio-only capability', () => {
	const fileInputs = walk(SRC)
		.filter((path) => path.endsWith('.svelte'))
		.flatMap((path) => {
			const source = readFileSync(path, 'utf8');
			const tags = source.match(/<input[^>]*type="file"[^>]*>/g) ?? [];
			return tags.map((tag) => ({ path: path.replace(SRC, 'src'), tag }));
		});

	it('file inputs exist only inside the studio', () => {
		const outside = fileInputs.filter((f) => !f.path.startsWith('src/routes/studio/'));
		expect(outside).toEqual([]);
	});

	it('guest and couple surfaces have zero file inputs', () => {
		const guestOrCouple = fileInputs.filter(
			(f) => f.path.startsWith('src/routes/e/') || f.path.startsWith('src/routes/dash/')
		);
		expect(guestOrCouple).toEqual([]);
	});

	it('every studio file input declares a restrictive accept list', () => {
		expect(fileInputs.length).toBeGreaterThanOrEqual(3); // audio + photos + video
		for (const { tag, path } of fileInputs) {
			expect(/accept="(audio|image|video)\/[^"]*"/.test(tag), `${path}: ${tag}`).toBe(true);
		}
	});

	it('the audio input stays audio-only', () => {
		const audio = fileInputs.filter((f) => f.path.includes('/audio/'));
		expect(audio).toHaveLength(1);
		expect(audio[0]!.tag).toContain('accept="audio/*"');
	});

	it('image/video uploads live on the theme page only', () => {
		const media = fileInputs.filter((f) => /accept="(image|video)/.test(f.tag));
		for (const { path } of media) {
			expect(path).toBe('src/routes/studio/(app)/events/[id]/theme/+page.svelte');
		}
	});
});
