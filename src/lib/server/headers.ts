// Response hardening beyond the CSP (which SvelteKit renders with nonces —
// see vite.config.ts). Applied to every response in hooks.server.ts.
const SECURITY_HEADERS: Record<string, string> = {
	'strict-transport-security': 'max-age=31536000; includeSubDomains',
	'referrer-policy': 'same-origin',
	'x-content-type-options': 'nosniff',
	'x-frame-options': 'SAMEORIGIN',
	'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=()'
};

export function applySecurityHeaders(headers: Headers): void {
	for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
		if (!headers.has(name)) headers.set(name, value);
	}
}
