import { describe, it, expect } from 'vitest';
import { applySecurityHeaders } from '../../src/lib/server/headers';

describe('security headers (spec §7.2 — one hooks file)', () => {
	it('sets the transport/content hardening set', () => {
		const headers = new Headers();
		applySecurityHeaders(headers);
		expect(headers.get('strict-transport-security')).toBe('max-age=31536000; includeSubDomains');
		expect(headers.get('referrer-policy')).toBe('same-origin');
		expect(headers.get('x-content-type-options')).toBe('nosniff');
		expect(headers.get('x-frame-options')).toBe('SAMEORIGIN');
		expect(headers.get('permissions-policy')).toContain('camera=()');
	});

	it('never overrides an existing header', () => {
		const headers = new Headers({ 'referrer-policy': 'no-referrer' });
		applySecurityHeaders(headers);
		expect(headers.get('referrer-policy')).toBe('no-referrer');
	});
});
