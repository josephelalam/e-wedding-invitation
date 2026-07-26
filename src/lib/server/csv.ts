// Hand-rolled RFC-4180 subset (quoted fields, escaped quotes, CRLF) — the
// import format is 5 positional columns and guest labels legitimately contain
// commas ("Karam, Elie & Maya"), so naive split(',') is not an option.

export type ParsedGuestRow = {
	guestLabel: string;
	maxSeats: number;
	phone: string | null;
	lang: string | null;
	groupTag: string | null;
};

export type CsvRowError = { line: number; message: string };

const LANG_CODES = new Set(['ar', 'fr', 'en']);

function splitCsvLine(line: string): string[] {
	const fields: string[] = [];
	let current = '';
	let inQuotes = false;
	for (let i = 0; i < line.length; i++) {
		const ch = line[i]!;
		if (inQuotes) {
			if (ch === '"') {
				if (line[i + 1] === '"') {
					current += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				current += ch;
			}
		} else if (ch === '"' && current === '') {
			inQuotes = true;
		} else if (ch === ',') {
			fields.push(current);
			current = '';
		} else {
			current += ch;
		}
	}
	fields.push(current);
	return fields;
}

/**
 * wa.me needs international digits with no plus. Lebanese local numbers
 * (leading 0) get the 961 country code; anything unusable becomes null so an
 * odd phone never blocks a guest import.
 */
export function normalizePhone(input: string | null | undefined): string | null {
	if (!input) return null;
	const trimmed = input.trim();
	if (!trimmed) return null;
	const international = trimmed.startsWith('+');
	const digits = trimmed.replace(/\D/g, '');
	if (digits.length < 6 || digits.length > 15) return null;
	if (international) return digits;
	if (digits.startsWith('0')) return `961${digits.slice(1)}`;
	return digits;
}

/** Columns: guest_label, max_seats[, phone[, lang[, group_tag]]]. Per-row errors never abort the batch. */
export function parseGuestCsv(text: string): { rows: ParsedGuestRow[]; errors: CsvRowError[] } {
	const rows: ParsedGuestRow[] = [];
	const errors: CsvRowError[] = [];
	const lines = text.split(/\r\n|\n|\r/);
	let firstDataLineSeen = false;

	for (let idx = 0; idx < lines.length; idx++) {
		const raw = lines[idx]!;
		const line = idx + 1;
		if (!raw.trim()) continue;
		const fields = splitCsvLine(raw).map((f) => f.trim());

		if (!firstDataLineSeen) {
			firstDataLineSeen = true;
			const joined = fields.join(' ').toLowerCase();
			if (/guest|name|invit/.test(joined) && /seat|place/.test(joined)) continue; // header row
		}

		const [label, seatsRaw, phoneRaw, langRaw, groupRaw] = fields;
		if (!label) {
			errors.push({ line, message: 'guest label is required' });
			continue;
		}
		const seats = Number(seatsRaw);
		if (!seatsRaw || !Number.isInteger(seats) || seats < 1) {
			errors.push({ line, message: `invalid seat count "${seatsRaw ?? ''}"` });
			continue;
		}
		let lang: string | null = null;
		if (langRaw) {
			const normalized = langRaw.toLowerCase();
			if (!LANG_CODES.has(normalized)) {
				errors.push({ line, message: `unknown lang "${langRaw}" — use ar, fr or en` });
				continue;
			}
			lang = normalized;
		}
		rows.push({
			guestLabel: label,
			maxSeats: seats,
			phone: normalizePhone(phoneRaw),
			lang,
			groupTag: groupRaw || null
		});
	}
	return { rows, errors };
}
