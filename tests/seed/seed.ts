/**
 * Seeds the LOCAL D1 (wrangler --local state) with a realistic demo wedding
 * and uploads the silent audio fixture to local R2. Idempotent: re-running
 * replaces the demo event. Prints guest URLs to open.
 *
 * Run via: npm run seed   (applies local migrations first)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateToken, newId } from '../../src/lib/server/crypto.ts';

const BASE_URL = process.env.SEED_BASE_URL ?? 'http://localhost:8787';
const q = (value: string) => `'${value.replaceAll("'", "''")}'`;
const now = new Date().toISOString();

const eventId = newId();
const slug = 'elie-and-maya';

const theme = {
	preset: 'classic',
	monogram: 'E·M',
	musicKey: `audio/${eventId}.mp3`,
	texts: {
		welcome: {
			en: 'With hearts full of joy, we invite you to celebrate our wedding.',
			fr: 'Le cœur rempli de joie, nous vous invitons à célébrer notre mariage.',
			ar: 'بقلوب مليئة بالفرح، ندعوكم لمشاركتنا فرحة زفافنا.'
		},
		closing: {
			en: 'Your presence is our greatest gift.',
			fr: 'Votre présence est notre plus beau cadeau.',
			ar: 'حضوركم هو أجمل هدية.'
		}
	}
};

const guests: [label: string, seats: number, phone: string | null, lang: string | null][] = [
	['Teta Georgette', 1, null, 'ar'],
	['Jad & Rita Khoury', 2, '9613123456', 'fr'],
	['Marc Abou Jaoude', 1, '96170111222', 'en'],
	['عائلة بو خليل', 3, null, null],
	['Les cousins de Paris', 2, '33612345678', 'fr']
];

const invitationRows = guests.map(([label, seats, phone, lang]) => ({
	id: newId(),
	token: generateToken(),
	label,
	seats,
	phone,
	lang
}));

const statements = [
	`DELETE FROM events WHERE slug = ${q(slug)};`,
	`INSERT INTO events (id, slug, type, title_en, title_ar, title_fr, date_main, dates_extra, theme, languages, status, payment_status, retention_months, created_at, updated_at)
	 VALUES (${q(eventId)}, ${q(slug)}, 'wedding', 'Elie & Maya', ${q('إيلي ومايا')}, 'Elie & Maya',
	 '2026-09-12T16:30:00+03:00',
	 ${q(
			JSON.stringify([
				{
					label: { en: 'Farewell brunch', fr: "Brunch d'adieu", ar: 'فطور الوداع' },
					at: '2026-09-13T11:00:00+03:00'
				}
			])
		)},
	 ${q(JSON.stringify(theme))}, ${q(JSON.stringify(['ar', 'fr', 'en']))}, 'live', 'deposit', 6, ${q(now)}, ${q(now)});`,
	`INSERT INTO locations (id, event_id, kind, label_en, label_ar, label_fr, maps_url, starts_at, sort)
	 VALUES
	 (${q(newId())}, ${q(eventId)}, 'house_groom', ${q("Groom's house — Baabdat")}, ${q('منزل العريس — بعبدات')}, ${q('Maison du marié — Baabdat')}, 'https://maps.app.goo.gl/demo-baabdat', '2026-09-12T14:30:00+03:00', 1),
	 (${q(newId())}, ${q(eventId)}, 'ceremony', ${q('Saint Mikhael Church, Achrafieh')}, ${q('كنيسة مار مخايل — الأشرفية')}, ${q('Église Saint-Michel, Achrafieh')}, 'https://maps.app.goo.gl/demo-marmikhael', '2026-09-12T16:30:00+03:00', 2),
	 (${q(newId())}, ${q(eventId)}, 'reception', ${q('Seaside Pavilion, Dbayeh')}, ${q('أجنحة الواجهة البحرية — ضبية')}, ${q('Pavillon du bord de mer, Dbayeh')}, 'https://maps.app.goo.gl/demo-pavilion', '2026-09-12T20:00:00+03:00', 3);`,
	`INSERT INTO invitations (id, event_id, token, guest_label, max_seats, phone, lang, group_tag, revoked, created_at)
	 VALUES ${invitationRows
			.map(
				(row) =>
					`(${q(row.id)}, ${q(eventId)}, ${q(row.token)}, ${q(row.label)}, ${row.seats}, ${
						row.phone ? q(row.phone) : 'NULL'
					}, ${row.lang ? q(row.lang) : 'NULL'}, NULL, 0, ${q(now)})`
			)
			.join(',\n	 ')};`
];

const dir = mkdtempSync(join(tmpdir(), 'einvite-seed-'));
const sqlFile = join(dir, 'seed.sql');
writeFileSync(sqlFile, statements.join('\n\n'));

function wrangler(args: string[]) {
	execFileSync('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
}

console.log('· applying seed SQL to local D1');
wrangler(['d1', 'execute', 'einvite-db', '--local', '--file', sqlFile]);

console.log('· uploading demo audio track to local R2');
wrangler([
	'r2',
	'object',
	'put',
	`einvite-media/audio/${eventId}.mp3`,
	'--file',
	'tests/fixtures/silence.mp3',
	'--content-type',
	'audio/mpeg',
	'--local'
]);

console.log('\nDemo wedding seeded: Elie & Maya — 12 Sep 2026');
console.log('Open a card:');
for (const row of invitationRows) {
	console.log(`  ${row.label.padEnd(24)} ${BASE_URL}/e/${slug}/i/${row.token}`);
}
