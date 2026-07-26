import { describe, it, expect } from 'vitest';
import { generateToken, newId, pbkdf2Hash, pbkdf2Verify } from '../../src/lib/server/crypto';

const BASE58 = /^[1-9A-HJ-NP-Za-km-z]+$/;

describe('generateToken', () => {
	it('produces 22-char base58 tokens by default (~128 bits)', () => {
		const token = generateToken();
		expect(token).toHaveLength(22);
		expect(token).toMatch(BASE58);
	});

	it('respects a custom length', () => {
		expect(generateToken(30)).toHaveLength(30);
	});

	it('never repeats across 1000 generations', () => {
		const seen = new Set(Array.from({ length: 1000 }, () => generateToken()));
		expect(seen.size).toBe(1000);
	});

	it('uses the full alphabet without obvious bias', () => {
		// 58 chars × ~380 expected hits each; every char should appear at least once
		const counts = new Map<string, number>();
		for (let i = 0; i < 1000; i++) {
			for (const ch of generateToken()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
		}
		expect(counts.size).toBe(58);
	});
});

describe('newId', () => {
	it('produces 17-char base58 ids (~96 bits)', () => {
		const id = newId();
		expect(id).toHaveLength(17);
		expect(id).toMatch(BASE58);
	});

	it('never repeats across 1000 generations', () => {
		const seen = new Set(Array.from({ length: 1000 }, () => newId()));
		expect(seen.size).toBe(1000);
	});
});

describe('pbkdf2', () => {
	it('hashes and verifies a password', async () => {
		const hash = await pbkdf2Hash('correct horse battery');
		expect(hash).toMatch(/^pbkdf2\$100000\$[A-Za-z0-9_-]+\$[A-Za-z0-9_-]+$/);
		await expect(pbkdf2Verify(hash, 'correct horse battery')).resolves.toBe(true);
	});

	it('rejects a wrong password', async () => {
		const hash = await pbkdf2Hash('correct horse battery');
		await expect(pbkdf2Verify(hash, 'wrong')).resolves.toBe(false);
	});

	it('salts every hash differently', async () => {
		const a = await pbkdf2Hash('same');
		const b = await pbkdf2Hash('same');
		expect(a).not.toBe(b);
	});

	it('returns false for malformed stored hashes instead of throwing', async () => {
		await expect(pbkdf2Verify('garbage', 'x')).resolves.toBe(false);
	});
});
