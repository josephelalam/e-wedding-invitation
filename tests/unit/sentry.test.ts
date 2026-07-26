import { describe, it, expect, vi } from 'vitest';
import { parseDsn, captureError } from '../../src/lib/server/sentry';

describe('parseDsn', () => {
	it('builds the envelope endpoint from a standard DSN', () => {
		expect(parseDsn('https://abc123@o450.ingest.sentry.io/123456')).toEqual({
			endpoint: 'https://o450.ingest.sentry.io/api/123456/envelope/',
			publicKey: 'abc123'
		});
	});

	it('returns null for missing or malformed DSNs', () => {
		expect(parseDsn(undefined)).toBeNull();
		expect(parseDsn('')).toBeNull();
		expect(parseDsn('not a url')).toBeNull();
		expect(parseDsn('https://host/1')).toBeNull(); // no key
	});
});

describe('captureError', () => {
	it('is a no-op without a DSN', async () => {
		const fetcher = vi.fn();
		await captureError({ dsn: undefined, source: 'server' }, new Error('x'), fetcher as never);
		expect(fetcher).not.toHaveBeenCalled();
	});

	it('posts a sentry envelope when configured', async () => {
		const fetcher = vi.fn().mockResolvedValue(new Response('ok'));
		await captureError(
			{ dsn: 'https://key@o1.ingest.sentry.io/42', source: 'server', url: 'https://x/e/a/i/b' },
			new Error('boom'),
			fetcher as never
		);
		expect(fetcher).toHaveBeenCalledOnce();
		const [url, init] = fetcher.mock.calls[0]!;
		expect(url).toBe('https://o1.ingest.sentry.io/api/42/envelope/');
		expect(init.body).toContain('"type":"event"');
		expect(init.body).toContain('boom');
	});

	it('swallows transport failures', async () => {
		const fetcher = vi.fn().mockRejectedValue(new Error('down'));
		await expect(
			captureError(
				{ dsn: 'https://key@o1.ingest.sentry.io/42', source: 'server' },
				new Error('x'),
				fetcher as never
			)
		).resolves.toBeUndefined();
	});
});
