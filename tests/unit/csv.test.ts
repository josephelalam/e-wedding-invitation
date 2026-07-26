import { describe, it, expect } from 'vitest';
import { parseGuestCsv, normalizePhone } from '../../src/lib/server/csv';

describe('parseGuestCsv', () => {
	it('parses positional columns: guest_label, max_seats, phone, lang, group_tag', () => {
		const { rows, errors } = parseGuestCsv('Elie & Maya,2,+961 3 123456,fr,friends');
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			{
				guestLabel: 'Elie & Maya',
				maxSeats: 2,
				phone: '9613123456',
				lang: 'fr',
				groupTag: 'friends'
			}
		]);
	});

	it('treats trailing columns as optional', () => {
		const { rows, errors } = parseGuestCsv('Teta Georgette,1');
		expect(errors).toEqual([]);
		expect(rows).toEqual([
			{ guestLabel: 'Teta Georgette', maxSeats: 1, phone: null, lang: null, groupTag: null }
		]);
	});

	it('skips a header row when present', () => {
		const { rows } = parseGuestCsv('guest_label,max_seats,phone,lang,group_tag\nRami,1');
		expect(rows).toHaveLength(1);
		expect(rows[0]!.guestLabel).toBe('Rami');
	});

	it('handles quoted fields containing commas and quotes', () => {
		const { rows } = parseGuestCsv('"Karam, Elie ""Abou Jad"" & Maya",3');
		expect(rows[0]!.guestLabel).toBe('Karam, Elie "Abou Jad" & Maya');
		expect(rows[0]!.maxSeats).toBe(3);
	});

	it('handles Arabic labels and CRLF line endings', () => {
		const { rows, errors } = parseGuestCsv('جاد وريتا,2,,ar\r\nعمو سمير,1\r\n');
		expect(errors).toEqual([]);
		expect(rows.map((r) => r.guestLabel)).toEqual(['جاد وريتا', 'عمو سمير']);
		expect(rows[0]!.lang).toBe('ar');
	});

	it('skips blank lines', () => {
		const { rows } = parseGuestCsv('A,1\n\n\nB,2\n');
		expect(rows).toHaveLength(2);
	});

	it('reports per-row errors without aborting the batch', () => {
		const { rows, errors } = parseGuestCsv('Good,2\nNoSeats\nBad Seats,zero\nZero,0\nAlso Good,4');
		expect(rows.map((r) => r.guestLabel)).toEqual(['Good', 'Also Good']);
		expect(errors).toHaveLength(3);
		expect(errors.map((e) => e.line)).toEqual([2, 3, 4]);
	});

	it('rejects unknown languages as row errors', () => {
		const { rows, errors } = parseGuestCsv('X,1,,de');
		expect(rows).toEqual([]);
		expect(errors[0]!.line).toBe(1);
		expect(errors[0]!.message).toMatch(/lang/i);
	});

	it('rejects empty guest labels', () => {
		const { errors } = parseGuestCsv(' ,2');
		expect(errors).toHaveLength(1);
	});
});

describe('normalizePhone', () => {
	it('strips formatting and the international plus', () => {
		expect(normalizePhone('+961 3 123-456')).toBe('9613123456');
	});

	it('converts a Lebanese leading zero to the 961 country code', () => {
		expect(normalizePhone('03 123 456')).toBe('9613123456');
	});

	it('keeps foreign international numbers intact', () => {
		expect(normalizePhone('+33 6 12 34 56 78')).toBe('33612345678');
	});

	it('returns null for empty or non-numeric input', () => {
		expect(normalizePhone('')).toBeNull();
		expect(normalizePhone('n/a')).toBeNull();
	});
});
