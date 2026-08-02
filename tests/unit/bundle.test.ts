import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

// three.js must reach guests ONLY through overture's async chunk. A guest on
// depth — or any pre-existing template — downloads zero extra bytes.
//
// The naive check (grep `_app/immutable/entry/*.js` for a marker) is too
// weak: SvelteKit gives every route node its own `isEntry: true` record in
// the Vite manifest (that's how it lazy-loads routes client-side), so the
// registry that statically imports every template — and, through overture's
// Template.svelte, the Envelope component — lives in one of those node
// chunks, not in `entry/`. A test that only reads `entry/` would never see
// it and would pass even if three.js were bundled into every guest's
// critical path. So this test reconstructs what a guest's browser actually
// fetches eagerly: the transitive closure of static `imports` edges (never
// `dynamicImports`) starting from every `isEntry` record in the manifest.
const CLIENT_DIR = '.svelte-kit/output/client';
const MANIFEST_PATH = join(CLIENT_DIR, '.vite/manifest.json');

// Determined empirically (see task-5-report.md): three.js's core module
// probes `globalThis.__THREE_DEVTOOLS__` unconditionally on load to announce
// itself to the devtools extension. It's a property name read off a global
// object, not a local class/binding, so a minifier has no reason — and no
// safe way — to rename it. `WebGLRenderer` is NOT used here because it's a
// local class identifier that build minification does rename.
const THREE_MARKER = '__THREE_DEVTOOLS__';

type ManifestChunk = {
	file: string;
	isEntry?: boolean;
	imports?: string[];
	dynamicImports?: string[];
};

type Manifest = Record<string, ManifestChunk>;

function loadManifest(): Manifest {
	if (!existsSync(MANIFEST_PATH)) {
		throw new Error(`run "npm run build" before this test — ${MANIFEST_PATH} is missing`);
	}
	return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as Manifest;
}

// Every chunk file reachable from an entry by following only static
// `imports` — i.e. everything a guest's browser fetches before a single
// dynamic `import()` in app code has run. `dynamicImports` edges are
// deliberately never followed; that's the lazy path this test exists to keep
// three.js off of.
function staticallyReachableFiles(manifest: Manifest): Set<string> {
	const files = new Set<string>();
	const visited = new Set<string>();
	const visit = (key: string) => {
		if (visited.has(key)) return;
		visited.add(key);
		const chunk = manifest[key];
		if (!chunk) return;
		files.add(chunk.file);
		for (const dep of chunk.imports ?? []) visit(dep);
	};
	for (const [key, chunk] of Object.entries(manifest)) {
		if (chunk.isEntry) visit(key);
	}
	return files;
}

function readJs(file: string): string | undefined {
	if (!file.endsWith('.js')) return undefined;
	const path = join(CLIENT_DIR, file);
	if (!existsSync(path)) return undefined;
	return readFileSync(path, 'utf8');
}

describe('bundle layout', () => {
	it('keeps three.js out of every statically-reachable chunk', () => {
		const manifest = loadManifest();
		const reachable = staticallyReachableFiles(manifest);

		for (const file of reachable) {
			const source = readJs(file);
			if (source === undefined) continue;
			expect(
				source.includes(THREE_MARKER),
				`three.js leaked into the eagerly-loaded chunk ${file}`
			).toBe(false);
		}
	});

	it('emits three.js only in a lazy chunk, under the size ceiling', () => {
		const manifest = loadManifest();
		const reachable = staticallyReachableFiles(manifest);
		const allFiles = new Set(Object.values(manifest).map((chunk) => chunk.file));
		const lazyFiles = [...allFiles].filter((file) => !reachable.has(file));

		const webgl = lazyFiles.find((file) => readJs(file)?.includes(THREE_MARKER));
		expect(webgl, 'three.js not found in any chunk').toBeDefined();

		const gzipped = gzipSync(readFileSync(join(CLIENT_DIR, webgl as string))).byteLength;
		expect(gzipped, `three.js chunk is ${Math.round(gzipped / 1024)} KB gzipped`).toBeLessThan(
			150 * 1024
		);
	});
});
