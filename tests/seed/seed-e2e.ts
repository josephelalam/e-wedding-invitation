/**
 * Deterministic fixtures for Playwright: fixed slugs and tokens so specs are
 * stable across runs. Applied on top of migrations by `npm run e2e:server`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { E2E } from './fixtures-e2e.ts';
import { pbkdf2Hash } from '../../src/lib/server/crypto.ts';

// wrangler's local Cache API persists on disk and outlives rebuilds/restarts;
// stale cached HTML references hashed chunks that no longer exist.
rmSync('.wrangler/state/v3/cache', { recursive: true, force: true });

const q = (value: string) => `'${value.replaceAll("'", "''")}'`;
const now = new Date().toISOString();

const theme = {
	preset: 'classic',
	monogram: 'N·L',
	musicKey: 'audio/e2e.wav',
	texts: {
		welcome: { en: 'We would love to celebrate with you.' },
		closing: { en: 'See you on the dance floor.' }
	}
};

function eventSql(id: string, slug: string, title: string) {
	return `INSERT INTO events (id, slug, type, title_en, title_ar, title_fr, date_main, dates_extra, theme, languages, status, payment_status, retention_months, created_at, updated_at)
VALUES (${q(id)}, ${q(slug)}, 'wedding', ${q(title)}, ${q('نور وليا')}, ${q(title)},
 '2027-06-05T17:00',
 ${q(JSON.stringify([{ label: { en: 'Sunday brunch' }, at: '2027-06-06T11:00' }]))},
 ${q(JSON.stringify(theme))}, ${q(JSON.stringify(['en', 'ar', 'fr']))}, 'live', 'pending', 6, ${q(now)}, ${q(now)});`;
}

const ownerHash = await pbkdf2Hash(E2E.owner.password);
const nowMs = Date.now();

const edgesTheme = {
	preset: 'classic',
	template: 'edges',
	monogram: 'R·T',
	effect: 'petals',
	images: ['theme/e2e/1.svg', 'theme/e2e/2.svg', 'theme/e2e/3.svg'],
	texts: {
		intro: { en: 'Therefore what God has joined together, let no one separate.' },
		parents: { en: 'Mr. & Mrs. Karam\nMr. & Mrs. Aoun' },
		gifts: { en: 'Your presence is our greatest gift.\nWedding list: 03 123 456' },
		endCaption: { en: 'And so the adventure begins…' }
	}
};

const cineTheme = {
	preset: 'midnight',
	template: 'cinematic',
	colors: { bg: '#141221', text: '#f4efe9', accent: '#d4af6a', muted: '#8d89a3' },
	images: ['theme/e2e/1.svg', 'theme/e2e/2.svg'],
	giftsAccountLabel: 'Whish Money',
	giftsAccount: '81 234 567',
	texts: {
		intro: { en: 'Two stories becoming one.' },
		gifts: { en: 'Your presence is the greatest gift.' }
	}
};

const depthTheme = {
	preset: 'classic',
	template: 'depth',
	monogram: 'D·P',
	effect: 'sparkles',
	images: ['theme/e2e/1.svg', 'theme/e2e/2.svg', 'theme/e2e/3.svg'],
	texts: {
		welcome: { en: 'Scroll gently — the day unfolds as you go.' },
		closing: { en: 'With all our love, always.' }
	}
};

const overtureTheme = {
	preset: 'classic',
	template: 'overture',
	monogram: 'O·V',
	images: ['theme/e2e/1.svg', 'theme/e2e/2.svg'],
	giftsAccountLabel: 'OMT',
	giftsAccount: '70 987 654',
	texts: {
		welcome: { en: 'The envelope is yours to open.' },
		gifts: { en: 'Your presence is the greatest gift.' },
		closing: { en: 'See you there.' }
	}
};

const statements = [
	// Deterministic test state: clear rate-limit windows and stale outbox links
	// accumulated by earlier local runs (the per-token RSVP limit is 10/hour).
	`DELETE FROM rate_limits;`,
	`DELETE FROM outbox;`,
	`DELETE FROM events WHERE slug IN (${q(E2E.slug)}, ${q(E2E.otherSlug)}, ${q(E2E.edgesSlug)}, ${q(E2E.cineSlug)}, ${q(E2E.depthSlug)}, ${q(E2E.overtureSlug)});`,
	`INSERT INTO events (id, slug, type, title_en, title_ar, title_fr, date_main, dates_extra, theme, languages, status, payment_status, retention_months, created_at, updated_at)
VALUES (${q(E2E.edgesEventId)}, ${q(E2E.edgesSlug)}, 'wedding', 'Rita & Tony', ${q('ريتا وطوني')}, 'Rita & Tony',
 '2027-08-14T17:00', '[]', ${q(JSON.stringify(edgesTheme))}, '["en","ar"]', 'live', 'pending', 6, ${q(now)}, ${q(now)}),
 (${q(E2E.cineEventId)}, ${q(E2E.cineSlug)}, 'wedding', 'Nour & Omar', ${q('نور وعمر')}, 'Nour & Omar',
 '2027-09-18T18:00', '[]', ${q(JSON.stringify(cineTheme))}, '["en","fr"]', 'live', 'pending', 6, ${q(now)}, ${q(now)});`,
	`INSERT INTO events (id, slug, type, title_en, title_ar, title_fr, date_main, dates_extra, theme, languages, status, payment_status, retention_months, created_at, updated_at)
VALUES (${q(E2E.depthEventId)}, ${q(E2E.depthSlug)}, 'wedding', 'Dana & Peter', ${q('دانا وبيتر')}, 'Dana & Peter',
 '2027-10-09T17:00', '[]', ${q(JSON.stringify(depthTheme))}, '["en","ar"]', 'live', 'pending', 6, ${q(now)}, ${q(now)}),
 (${q(E2E.overtureEventId)}, ${q(E2E.overtureSlug)}, 'wedding', 'Olivia & Victor', ${q('أوليفيا وفيكتور')}, 'Olivia & Victor',
 '2027-11-20T18:00', '[]', ${q(JSON.stringify(overtureTheme))}, '["en","fr"]', 'live', 'pending', 6, ${q(now)}, ${q(now)});`,
	`INSERT INTO locations (id, event_id, kind, label_en, maps_url, starts_at, sort) VALUES
 ('loc_e2e_edges1', ${q(E2E.edgesEventId)}, 'ceremony', 'Edges Chapel', 'https://maps.app.goo.gl/edges1', '2027-08-14T17:00', 1),
 ('loc_e2e_cine1', ${q(E2E.cineEventId)}, 'ceremony', 'Cine Cathedral', 'https://maps.app.goo.gl/cine1', '2027-09-18T18:00', 1),
 ('loc_e2e_cine2', ${q(E2E.cineEventId)}, 'house_groom', 'Cine Groom Home', 'https://maps.app.goo.gl/cine2', '2027-09-18T14:00', 2),
 ('loc_e2e_cine3', ${q(E2E.cineEventId)}, 'house_bride', 'Cine Bride Home', 'https://maps.app.goo.gl/cine3', '2027-09-18T15:00', 3),
 ('loc_e2e_cine4', ${q(E2E.cineEventId)}, 'reception', 'Cine Ballroom', 'https://maps.app.goo.gl/cine4', '2027-09-18T20:00', 4);`,
	`INSERT INTO locations (id, event_id, kind, label_en, maps_url, starts_at, sort) VALUES
 ('loc_e2e_depth1', ${q(E2E.depthEventId)}, 'ceremony', 'Depth Chapel', 'https://maps.app.goo.gl/depth1', '2027-10-09T17:00', 1),
 ('loc_e2e_over1', ${q(E2E.overtureEventId)}, 'ceremony', 'Overture Hall', 'https://maps.app.goo.gl/over1', '2027-11-20T18:00', 1);`,
	`INSERT INTO invitations (id, event_id, token, guest_label, max_seats, phone, lang, group_tag, revoked, created_at) VALUES
 ('inv_e2e_edges', ${q(E2E.edgesEventId)}, ${q(E2E.tokens.edges)}, 'Fadi & Nadine', 2, NULL, 'en', NULL, 0, ${q(now)}),
 ('inv_e2e_cine', ${q(E2E.cineEventId)}, ${q(E2E.tokens.cine)}, 'Sara', 1, NULL, 'en', NULL, 0, ${q(now)});`,
	`INSERT INTO invitations (id, event_id, token, guest_label, max_seats, phone, lang, group_tag, revoked, created_at) VALUES
 ('inv_e2e_depth', ${q(E2E.depthEventId)}, ${q(E2E.tokens.depth)}, 'Rami & Lea', 2, NULL, 'en', NULL, 0, ${q(now)}),
 ('inv_e2e_over', ${q(E2E.overtureEventId)}, ${q(E2E.tokens.overture)}, 'Ziad', 1, NULL, 'en', NULL, 0, ${q(now)});`,
	`DELETE FROM user WHERE email IN (${q(E2E.owner.email)}, ${q(E2E.couple.email)});`,
	`INSERT INTO user (id, name, email, email_verified, role, two_factor_enabled, created_at, updated_at) VALUES
 ('usr_e2e_owner', ${q(E2E.owner.name)}, ${q(E2E.owner.email)}, 1, 'owner', 0, ${nowMs}, ${nowMs}),
 ('usr_e2e_couple', ${q(E2E.couple.name)}, ${q(E2E.couple.email)}, 1, 'couple', 0, ${nowMs}, ${nowMs});`,
	`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES
 ('acc_e2e_owner', 'usr_e2e_owner', 'credential', 'usr_e2e_owner', ${q(ownerHash)}, ${nowMs}, ${nowMs});`,
	eventSql(E2E.eventId, E2E.slug, 'Nour & Leo'),
	eventSql(E2E.otherEventId, E2E.otherSlug, 'Other Event'),
	`INSERT INTO locations (id, event_id, kind, label_en, maps_url, starts_at, sort) VALUES
 ('loc_e2e_1', ${q(E2E.eventId)}, 'ceremony', 'E2E Chapel', 'https://maps.app.goo.gl/e2e1', '2027-06-05T17:00', 1),
 ('loc_e2e_2', ${q(E2E.eventId)}, 'reception', 'E2E Hall', 'https://maps.app.goo.gl/e2e2', '2027-06-05T20:00', 2);`,
	`INSERT INTO invitations (id, event_id, token, guest_label, max_seats, phone, lang, group_tag, revoked, created_at) VALUES
 ('inv_e2e_guest', ${q(E2E.eventId)}, ${q(E2E.tokens.guest)}, 'Sami & Dana', 2, '9613000111', 'en', 'friends', 0, ${q(now)}),
 ('inv_e2e_decl', ${q(E2E.eventId)}, ${q(E2E.tokens.decline)}, 'Karim', 1, NULL, 'en', NULL, 0, ${q(now)}),
 ('inv_e2e_revk', ${q(E2E.eventId)}, ${q(E2E.tokens.revoked)}, 'Revoked Guest', 2, NULL, 'en', NULL, 1, ${q(now)}),
 ('inv_e2e_othr', ${q(E2E.otherEventId)}, ${q(E2E.tokens.other)}, 'Other Guest', 2, NULL, 'en', NULL, 0, ${q(now)});`,
	`INSERT INTO couples (user_id, event_id) VALUES ('usr_e2e_couple', ${q(E2E.eventId)});`
];

const dir = mkdtempSync(join(tmpdir(), 'einvite-e2e-seed-'));
const sqlFile = join(dir, 'seed.sql');
writeFileSync(sqlFile, statements.join('\n\n'));

function wrangler(args: string[]) {
	execFileSync('npx', ['wrangler', ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
}

console.log('· seeding e2e fixtures into local D1');
wrangler(['d1', 'execute', 'einvite-db', '--local', '--file', sqlFile]);
console.log('· uploading e2e audio (wav decodes on every Playwright build)');
wrangler([
	'r2',
	'object',
	'put',
	'einvite-media/audio/e2e.wav',
	'--file',
	'tests/fixtures/silence.wav',
	'--content-type',
	'audio/wav',
	'--local'
]);
console.log('· uploading placeholder photos for the photo templates');
for (const index of [1, 2, 3]) {
	wrangler([
		'r2',
		'object',
		'put',
		`einvite-media/theme/e2e/${index}.svg`,
		'--file',
		`tests/fixtures/placeholder-${index}.svg`,
		'--content-type',
		'image/svg+xml',
		'--local'
	]);
}
console.log('e2e fixtures ready');
