// adapter-cloudflare owns the worker entry and offers no hook for a
// `scheduled` handler, so every build grafts one onto its output. wrangler
// bundles `main` with esbuild, which resolves the TS import below at
// deploy/dev time. Idempotent: safe to run twice.
import { readFileSync, writeFileSync } from 'node:fs';

const WORKER = '.svelte-kit/cloudflare/_worker.js';
const MARKER = '/* einvite:scheduled */';

const source = readFileSync(WORKER, 'utf8');
if (source.includes(MARKER)) {
	console.log('scheduled handler already present');
	process.exit(0);
}
if (!source.includes('worker_default')) {
	console.error(
		'adapter output changed shape (no worker_default) — update scripts/append-scheduled.mjs'
	);
	process.exit(1);
}

const patch = `
${MARKER}
import { runNightlyJobs as __einviteNightly } from '../../src/lib/server/jobs.ts';
worker_default.scheduled = (_controller, env, ctx) => {
	ctx.waitUntil(__einviteNightly(env));
};
`;
writeFileSync(WORKER, source + patch);
console.log('scheduled handler appended to', WORKER);
