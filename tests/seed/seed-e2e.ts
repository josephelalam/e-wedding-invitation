/**
 * Deterministic fixtures for Playwright: fixed slugs and tokens so specs are
 * stable across runs. Applied on top of migrations by `npm run e2e:server`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { E2E } from './fixtures-e2e.ts';
import { pbkdf2Hash } from '../../src/lib/server/crypto.ts';

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
 '2027-06-05T17:00:00+03:00',
 ${q(JSON.stringify([{ label: { en: 'Sunday brunch' }, at: '2027-06-06T11:00:00+03:00' }]))},
 ${q(JSON.stringify(theme))}, ${q(JSON.stringify(['en', 'ar', 'fr']))}, 'live', 'pending', 6, ${q(now)}, ${q(now)});`;
}

const ownerHash = await pbkdf2Hash(E2E.owner.password);
const nowMs = Date.now();

const statements = [
	`DELETE FROM events WHERE slug IN (${q(E2E.slug)}, ${q(E2E.otherSlug)});`,
	`DELETE FROM user WHERE email IN (${q(E2E.owner.email)}, ${q(E2E.couple.email)});`,
	`INSERT INTO user (id, name, email, email_verified, role, two_factor_enabled, created_at, updated_at) VALUES
 ('usr_e2e_owner', ${q(E2E.owner.name)}, ${q(E2E.owner.email)}, 1, 'owner', 0, ${nowMs}, ${nowMs}),
 ('usr_e2e_couple', ${q(E2E.couple.name)}, ${q(E2E.couple.email)}, 1, 'couple', 0, ${nowMs}, ${nowMs});`,
	`INSERT INTO account (id, account_id, provider_id, user_id, password, created_at, updated_at) VALUES
 ('acc_e2e_owner', 'usr_e2e_owner', 'credential', 'usr_e2e_owner', ${q(ownerHash)}, ${nowMs}, ${nowMs});`,
	eventSql(E2E.eventId, E2E.slug, 'Nour & Leo'),
	eventSql(E2E.otherEventId, E2E.otherSlug, 'Other Event'),
	`INSERT INTO locations (id, event_id, kind, label_en, maps_url, starts_at, sort) VALUES
 ('loc_e2e_1', ${q(E2E.eventId)}, 'ceremony', 'E2E Chapel', 'https://maps.app.goo.gl/e2e1', '2027-06-05T17:00:00+03:00', 1),
 ('loc_e2e_2', ${q(E2E.eventId)}, 'reception', 'E2E Hall', 'https://maps.app.goo.gl/e2e2', '2027-06-05T20:00:00+03:00', 2);`,
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
console.log('e2e fixtures ready');
