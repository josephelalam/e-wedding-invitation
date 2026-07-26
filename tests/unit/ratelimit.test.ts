import { describe, it, expect } from 'vitest';
import { testDb } from '../helpers/db';
import { rateLimit } from '../../src/lib/server/ratelimit';
import { verifyTurnstile } from '../../src/lib/server/turnstile';

describe('rateLimit (fixed window on D1 — no cache server, spec §4.7/§7.2)', () => {
	it('allows up to the limit inside one window', async () => {
		const { db } = testDb();
		const now = 1_000_000_000_000;
		for (let i = 0; i < 5; i++) {
			const res = await rateLimit(db, 'rsvp:ip:1.2.3.4', { limit: 5, windowSec: 3600, now });
			expect(res.allowed).toBe(true);
		}
		const sixth = await rateLimit(db, 'rsvp:ip:1.2.3.4', { limit: 5, windowSec: 3600, now });
		expect(sixth.allowed).toBe(false);
		expect(sixth.retryAfterSec).toBeGreaterThan(0);
		expect(sixth.retryAfterSec).toBeLessThanOrEqual(3600);
	});

	it('keys are independent', async () => {
		const { db } = testDb();
		const now = 1_000_000_000_000;
		await rateLimit(db, 'a', { limit: 1, windowSec: 60, now });
		const otherKey = await rateLimit(db, 'b', { limit: 1, windowSec: 60, now });
		expect(otherKey.allowed).toBe(true);
	});

	it('resets after the window rolls over', async () => {
		const { db } = testDb();
		const now = 1_000_000_000_000;
		await rateLimit(db, 'k', { limit: 1, windowSec: 60, now });
		const blocked = await rateLimit(db, 'k', { limit: 1, windowSec: 60, now: now + 30_000 });
		expect(blocked.allowed).toBe(false);
		const afterWindow = await rateLimit(db, 'k', { limit: 1, windowSec: 60, now: now + 61_000 });
		expect(afterWindow.allowed).toBe(true);
	});
});

describe('verifyTurnstile (env-gated: absent secret = open, spec cost constraint)', () => {
	it('skips verification when no secret is configured', async () => {
		const result = await verifyTurnstile(undefined, 'whatever', '1.1.1.1');
		expect(result).toEqual({ ok: true, skipped: true });
	});

	it('fails closed when a secret is set but the client sent no token', async () => {
		const result = await verifyTurnstile('sec', null, '1.1.1.1');
		expect(result.ok).toBe(false);
	});

	it('calls the siteverify endpoint and returns its verdict', async () => {
		const calls: { url: string; body: URLSearchParams }[] = [];
		const fetcher = (async (url: unknown, init?: RequestInit) => {
			calls.push({ url: String(url), body: init?.body as URLSearchParams });
			return new Response(JSON.stringify({ success: true }), { status: 200 });
		}) as typeof fetch;
		const result = await verifyTurnstile('sec', 'tok', '9.9.9.9', fetcher);
		expect(result.ok).toBe(true);
		expect(calls[0]!.url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
		expect(calls[0]!.body.get('secret')).toBe('sec');
		expect(calls[0]!.body.get('response')).toBe('tok');
		expect(calls[0]!.body.get('remoteip')).toBe('9.9.9.9');
	});

	it('fails closed on verifier outage (bots love outages)', async () => {
		const fetcher = (async () => {
			throw new Error('network');
		}) as unknown as typeof fetch;
		const result = await verifyTurnstile('sec', 'tok', undefined, fetcher);
		expect(result.ok).toBe(false);
	});
});
