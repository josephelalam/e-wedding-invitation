/**
 * Seeds the LOCAL D1 with one fully-dressed demo wedding per layout — five
 * events, every section populated, trilingual, so all five templates can be
 * compared side by side in a browser.
 *
 * Deliberately leaves `theme.images` empty: that makes each template fall back
 * to its curated bundled set in src/lib/templates/stock.ts (real Pexels
 * photography), rather than the placeholder SVGs the e2e fixtures use. Those
 * placeholders have "photo 1" printed on them and make the layouts look broken.
 *
 * Idempotent — re-running replaces the demo events by slug.
 *
 * Run: npm run seed:demo   (applies local migrations first)
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const now = new Date().toISOString();

const texts = {
	welcome: {
		en: 'With hearts full of joy, we invite you to celebrate our wedding.',
		fr: 'Le cœur rempli de joie, nous vous invitons à célébrer notre mariage.',
		ar: 'بقلوب مليئة بالفرح، ندعوكم لمشاركتنا فرحة زفافنا.'
	},
	intro: {
		en: 'Therefore what God has joined together, let no one separate.',
		fr: 'Que l’homme ne sépare donc pas ce que Dieu a uni.',
		ar: 'فالذي جمعه الله لا يفرقه إنسان.'
	},
	parents: {
		en: 'Mr. & Mrs. Karam Haddad\nMr. & Mrs. Elias Nassar',
		fr: 'M. & Mme Karam Haddad\nM. & Mme Elias Nassar',
		ar: 'السيد والسيدة كرم حداد\nالسيد والسيدة الياس نصار'
	},
	gifts: {
		en: 'Your presence is our greatest gift.',
		fr: 'Votre présence est notre plus beau cadeau.',
		ar: 'حضوركم هو أجمل هدية.'
	},
	closing: {
		en: 'See you on the dance floor.',
		fr: 'On se retrouve sur la piste.',
		ar: 'نراكم على حلبة الرقص.'
	},
	endCaption: {
		en: 'And so the adventure begins…',
		fr: 'Et l’aventure commence…',
		ar: 'وهكذا تبدأ الرحلة…'
	}
};

const datesExtra = JSON.stringify([
	{ label: { en: 'Henna night', fr: 'Soirée henné', ar: 'ليلة الحنة' }, at: '2027-06-11T20:00' },
	{
		label: { en: 'Sunday brunch', fr: 'Brunch du dimanche', ar: 'فطور الأحد' },
		at: '2027-06-13T11:00'
	}
]);

/** One demo wedding per layout. Distinct names so screenshots are unambiguous. */
const DEMOS = [
	{
		slug: 'demo-depth',
		template: 'depth',
		en: 'Dana & Peter',
		ar: 'دانا وبيتر',
		monogram: 'D·P',
		effect: 'sparkles',
		guest: 'Rami & Lea',
		token: 'DemoDepthTok1111111111'
	},
	{
		slug: 'demo-overture',
		template: 'overture',
		en: 'Olivia & Victor',
		ar: 'أوليفيا وفيكتور',
		monogram: 'O·V',
		effect: 'petals',
		guest: 'Ziad Haddad',
		token: 'DemoOvertTok1111111111'
	},
	{
		slug: 'demo-slides',
		template: 'slides',
		en: 'Nour & Leo',
		ar: 'نور وليو',
		monogram: 'N·L',
		effect: 'petals',
		guest: 'Sami & Dana',
		token: 'DemoSlidesTok111111111'
	},
	{
		slug: 'demo-edges',
		template: 'edges',
		en: 'Rita & Tony',
		ar: 'ريتا وطوني',
		monogram: 'R·T',
		effect: 'leaves',
		guest: 'Fadi & Nadine',
		token: 'DemoEdgesTok1111111111'
	},
	{
		slug: 'demo-cinematic',
		template: 'cinematic',
		en: 'Maya & Omar',
		ar: 'مايا وعمر',
		monogram: 'M·O',
		effect: 'hearts',
		guest: 'Teta Georgette',
		token: 'DemoCineTok11111111111'
	}
];

function themeJson(demo) {
	return JSON.stringify({
		preset: 'classic',
		template: demo.template,
		monogram: demo.monogram,
		effect: demo.effect,
		// Empty on purpose — falls back to the curated bundled stock set.
		images: [],
		musicKey: 'audio/demo.wav',
		giftsAccountLabel: 'Whish Money',
		giftsAccount: '03 456 789',
		texts
	});
}

const statements = [
	`DELETE FROM rate_limits;`,
	`DELETE FROM events WHERE slug IN (${DEMOS.map((d) => q(d.slug)).join(', ')});`
];

for (const [index, demo] of DEMOS.entries()) {
	const eventId = `ev_demo_${index}${'0'.repeat(9)}`;
	statements.push(
		`INSERT INTO events (id, slug, type, title_en, title_ar, title_fr, date_main, dates_extra, theme, languages, status, payment_status, retention_months, created_at, updated_at)
VALUES (${q(eventId)}, ${q(demo.slug)}, 'wedding', ${q(demo.en)}, ${q(demo.ar)}, ${q(demo.en)},
 '2027-06-12T17:00', ${q(datesExtra)}, ${q(themeJson(demo))}, '["en","fr","ar"]', 'live', 'paid', 6, ${q(now)}, ${q(now)});`,
		// Both house_* locations so the cinematic "getting ready" scene renders.
		`INSERT INTO locations (id, event_id, kind, label_en, label_ar, label_fr, maps_url, starts_at, sort) VALUES
 ('loc_demo_${index}_1', ${q(eventId)}, 'house_bride', 'Bride''s home, Achrafieh', ${q('منزل العروس، الأشرفية')}, 'Maison de la mariée, Achrafieh', 'https://maps.app.goo.gl/demo1', '2027-06-12T14:00', 1),
 ('loc_demo_${index}_2', ${q(eventId)}, 'house_groom', 'Groom''s home, Hazmieh', ${q('منزل العريس، الحازمية')}, 'Maison du marié, Hazmieh', 'https://maps.app.goo.gl/demo2', '2027-06-12T14:30', 2),
 ('loc_demo_${index}_3', ${q(eventId)}, 'ceremony', 'Saint Nicolas Church', ${q('كنيسة مار نقولا')}, 'Église Saint-Nicolas', 'https://maps.app.goo.gl/demo3', '2027-06-12T17:00', 3),
 ('loc_demo_${index}_4', ${q(eventId)}, 'reception', 'Le Maillon, Bikfaya', ${q('لو مايون، بكفيا')}, 'Le Maillon, Bikfaya', 'https://maps.app.goo.gl/demo4', '2027-06-12T20:00', 4);`,
		`INSERT INTO invitations (id, event_id, token, guest_label, max_seats, phone, lang, group_tag, revoked, created_at) VALUES
 ('inv_demo_${index}', ${q(eventId)}, ${q(demo.token)}, ${q(demo.guest)}, 4, NULL, 'en', 'demo', 0, ${q(now)});`
	);
}

const dir = mkdtempSync(join(tmpdir(), 'einvite-demo-seed-'));
const sqlFile = join(dir, 'demo.sql');
writeFileSync(sqlFile, statements.join('\n\n'));

const wrangler = (args) =>
	execFileSync('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });

console.log('· seeding five demo weddings into local D1');
wrangler(['d1', 'execute', 'einvite-db', '--local', '--file', sqlFile]);

console.log('· uploading demo audio (silent placeholder — proves the unlock gesture)');
wrangler([
	'r2',
	'object',
	'put',
	'einvite-media/audio/demo.wav',
	'--file',
	'tests/fixtures/silence.wav',
	'--content-type',
	'audio/wav',
	'--local'
]);

rmSync(dir, { recursive: true, force: true });

const base = process.env.SEED_BASE_URL ?? 'http://localhost:8787';
console.log('\n  Five demo invitations ready. Open these:\n');
for (const demo of DEMOS) {
	console.log(`  ${demo.template.padEnd(10)} ${base}/e/${demo.slug}/i/${demo.token}`);
}
console.log(`\n  Add ?lang=ar or ?lang=fr to any of them.`);
console.log(`  Studio: ${base}/studio  —  e2e-owner@example.com / e2e-owner-passphrase-1\n`);
