// Token + password primitives. WebCrypto only — must run identically on
// Cloudflare Workers, Node (tests) and the better-auth CLI.

const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** Uniform base58 string via rejection sampling (232 = 4×58, so no modulo bias). */
function randomBase58(length: number): string {
	const out: string[] = [];
	const buf = new Uint8Array(length * 2);
	while (out.length < length) {
		crypto.getRandomValues(buf);
		for (const byte of buf) {
			if (out.length === length) break;
			if (byte < 232) out.push(BASE58[byte % 58]!);
		}
	}
	return out.join('');
}

/** Guest capability token: 22 base58 chars ≈ 129 bits of entropy. */
export function generateToken(length = 22): string {
	return randomBase58(length);
}

/** Row id: 17 base58 chars ≈ 100 bits. */
export function newId(): string {
	return randomBase58(17);
}

// PBKDF2-SHA256. 100k iterations keeps a single owner login inside the
// Workers free-plan CPU budget (native WebCrypto), traded against the
// account also being TOTP-protected (spec §4.4).
const ITERATIONS = 100_000;

function toB64url(bytes: Uint8Array): string {
	let s = '';
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
	const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
	return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(password),
		'PBKDF2',
		false,
		['deriveBits']
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
		key,
		256
	);
	return new Uint8Array(bits);
}

export async function pbkdf2Hash(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const dk = await derive(password, salt, ITERATIONS);
	return `pbkdf2$${ITERATIONS}$${toB64url(salt)}$${toB64url(dk)}`;
}

export async function pbkdf2Verify(stored: string, password: string): Promise<boolean> {
	try {
		const [scheme, iterStr, saltB64, hashB64] = stored.split('$');
		if (scheme !== 'pbkdf2' || !iterStr || !saltB64 || !hashB64) return false;
		const iterations = Number(iterStr);
		if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1_000_000) return false;
		const expected = fromB64url(hashB64);
		const actual = await derive(password, fromB64url(saltB64), iterations);
		if (expected.length === 0 || expected.length !== actual.length) return false;
		let diff = 0;
		for (let i = 0; i < expected.length; i++) diff |= expected[i]! ^ actual[i]!;
		return diff === 0;
	} catch {
		return false;
	}
}
