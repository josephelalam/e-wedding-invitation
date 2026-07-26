# E-Invitation Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build, test locally, and deploy to production the managed wedding e-invitation platform specified in `architecture-einvitation-platform.md` (v1.1, approved).

**Architecture:** One SvelteKit (Svelte 5, TypeScript) app deployed as a single Cloudflare Worker: public invitation renderer (`/e/[slug]/i/[token]`, edge-cached, music-on-open cover + scroll-snap slides), couple dashboard (`/dash`, magic-link auth), owner studio (`/studio`, password+TOTP auth). Data in Cloudflare D1 (SQLite) via Drizzle ORM; one audio file per event in R2; nightly backup + retention purge via Cron Trigger.

**Tech Stack:** SvelteKit 2 / Svelte 5, TypeScript strict, `@sveltejs/adapter-cloudflare`, Drizzle ORM + drizzle-kit (plain SQL migrations), Better Auth (magic link + TOTP plugins; hand-rolled fallback is spec-sanctioned), Zod, Vitest (+ better-sqlite3 for DB-level unit tests), Playwright, wrangler v4.

## Global Constraints (copied from spec — override everything)

1. **No photo uploading anywhere.** The only upload control in the entire system is the event's audio track (studio). No image pipeline, no gallery, no guest photo wall.
2. **Music-on-open guest experience.** Cover page → one start button = the audio unlock gesture → swipeable full-viewport slides (CSS scroll-snap). One persistent `<audio>` element outside the scroll container, never re-mounted; floating mute toggle; pause on `visibilitychange`; page works silently if cover bypassed. RSVP is a progressive-enhancement form (works without JS).
3. **Near-zero cost:** $0/month infra. No paid service. No Google Maps API key (plain `maps_url` links). No email SaaS required (magic links surface in the studio outbox for WhatsApp forwarding; optional Resend driver only if key provided). Turnstile/Sentry env-gated, free tiers only.
4. Workers free plan: ~10 ms CPU/request → password hashing uses WebCrypto PBKDF2 (100k iters, SHA-256) via Better Auth custom hash, not scrypt.
5. Trilingual day one: `ar` (RTL), `fr`, `en`; per-invitation `lang` override; i18n completeness enforced by a unit test.
6. Tokens: ≥128-bit CSPRNG, base58, bias-free; capability = possession; per-card revocation flag.
7. Tenant isolation: every query scoped by `event_id` derived server-side from session/token, never from client input.
8. Seat ceiling enforced 3×: form UI, server action (Zod + service), and DB trigger (`confirmed_seats ≤ max_seats`).
9. Data model is event-agnostic (`events.type`), locations are an ordered typed list (0..n), not four fixed fields.
10. Node 22 (`.nvmrc`), npm. All shell commands assume `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"`.

**Environment facts (verified 2026-07-26):** Node 22.23.1 via nvm; no `gh` CLI (GitHub push = manual follow-up); no Cloudflare credentials yet (`wrangler login` is a user-input gate before Task 24); project root `/home/joseph/Desktop/e-invitation` (not yet a git repo).

**Version-drift rule:** npm installs latest compatible versions. Where this plan shows library-specific API (Better Auth, Drizzle, adapter), verify against the installed version's types/docs and adapt syntax, not intent. If Better Auth fights Workers/D1 for >90 minutes, switch to the spec's fallback: hand-rolled sessions + WebCrypto TOTP (RFC 6238) + magic-link table.

---

## File Structure (target)

```
e-invitation/                       # repo root (existing architecture md stays at root)
├─ .nvmrc  .gitignore  package.json  svelte.config.js  vite.config.ts  tsconfig.json
├─ wrangler.jsonc                   # all infra: D1/R2/assets/cron/vars
├─ drizzle.config.ts
├─ drizzle/                         # generated SQL migrations (plain, auditable) + custom trigger migration
├─ server/worker.ts                 # wrapper entry: fetch → SvelteKit worker, scheduled → jobs
├─ src/
│  ├─ app.d.ts  app.html  hooks.server.ts
│  ├─ lib/
│  │  ├─ i18n/  en.json  fr.json  ar.json  index.ts
│  │  ├─ themes/ schema.ts (Zod) + classic.ts + midnight.ts presets
│  │  ├─ components/ AudioPlayer.svelte
│  │  │  └─ sections/ Cover.svelte Hero.svelte Countdown.svelte Locations.svelte Schedule.svelte RsvpForm.svelte Closing.svelte
│  │  └─ server/
│  │     ├─ db/ schema.ts  index.ts (drizzle factory)
│  │     ├─ auth.ts (Better Auth factory)  guards.ts (requireOwner/requireCouple)
│  │     ├─ crypto.ts (token gen, pbkdf2)  csv.ts  ratelimit.ts  turnstile.ts  sentry.ts
│  │     ├─ services/ invitations.ts  rsvp.ts  events.ts  export.ts  audit.ts
│  │     └─ jobs.ts (nightly backup → R2, retention purge, token cleanup)
│  └─ routes/
│     ├─ +layout.svelte  +error.svelte
│     ├─ e/[slug]/i/[token]/ +page.server.ts +page.svelte  (public, cached)
│     ├─ e/[slug]/i/[token]/opengraph descriptors in page head
│     ├─ dash/ login/+page.server.ts|.svelte   [event]/+page.server.ts|.svelte  (couple)
│     ├─ studio/ +layout.server.ts (guard)  +page.svelte (event list)
│     │   ├─ setup/ (owner bootstrap, SETUP_TOKEN-gated)
│     │   ├─ login/  events/[id]/ (edit, theme, locations)  events/[id]/guests/  events/[id]/audio/
│     ├─ api/ rsvp/[token]/+server.ts   events/[id]/export.csv/+server.ts
│     │   ├─ audio/[key]/+server.ts (R2 stream, immutable)   healthz/+server.ts   log/+server.ts
│     └─ (auth) Better Auth handler mounted in hooks
├─ tests/ unit/*.test.ts   e2e/*.spec.ts   fixtures/silence.mp3  seed/seed.ts
├─ static/ fonts/ (subset woff2)  favicon
├─ .github/workflows/ci.yml
└─ docs/ runbook.md  superpowers/plans|specs
```

---

### Task 0: Toolchain + scaffold

**Files:** Create `.nvmrc`, scaffold SvelteKit app into repo root, `git init`.

- [x] Node 22.23.1 installed via nvm (done during planning)
- [ ] `npx sv create` with TS, prettier, eslint, vitest, playwright, adapter-cloudflare — scaffold in scratchpad dir, rsync into root (root non-empty), keep `architecture-einvitation-platform.md` untouched
- [ ] `.nvmrc` = `22`; `git init -b main`; `.gitignore` includes `.wrangler/`, `.env*`, `node_modules/`, `.svelte-kit/`, `test-results/`
- [ ] `npm run check` passes on virgin scaffold; commit `chore: scaffold sveltekit app`

### Task 1: wrangler.jsonc + adapter config

**Files:** Create `wrangler.jsonc`; modify `svelte.config.js`, `vite.config.ts`.

**Produces:** `platform.env` bindings `DB` (D1), `MEDIA` (R2), vars `PUBLIC_BASE_URL`, secrets `BETTER_AUTH_SECRET`, `SETUP_TOKEN`, optional `TURNSTILE_SECRET`/`PUBLIC_TURNSTILE_SITE_KEY`/`SENTRY_DSN`/`RESEND_API_KEY`; cron `"0 2 * * *"`; `migrations_dir: "drizzle"`; `nodejs_compat` flag.

```jsonc
// wrangler.jsonc (shape; database_id filled at deploy time, placeholder for local)
{
  "name": "einvite",
  "main": "server/worker.ts",
  "compatibility_date": "2026-07-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "d1_databases": [{ "binding": "DB", "database_name": "einvite-db", "database_id": "LOCAL-PLACEHOLDER", "migrations_dir": "drizzle" }],
  "r2_buckets": [{ "binding": "MEDIA", "bucket_name": "einvite-media" }],
  "triggers": { "crons": ["0 2 * * *"] },
  "vars": { "PUBLIC_BASE_URL": "http://localhost:8787" },
  "observability": { "enabled": true }
}
```

- [ ] Adapter: `adapter-cloudflare({ platformProxy: { configPath: 'wrangler.jsonc' } })`; `app.d.ts` Platform interface with `env: { DB: D1Database; MEDIA: R2Bucket; ... }`
- [ ] `server/worker.ts` wrapper (verify adapter output path at build):

```ts
import worker from '../.svelte-kit/cloudflare/_worker.js';
import { runNightlyJobs } from '../src/lib/server/jobs';
export default {
  fetch: worker.fetch,
  scheduled(event: ScheduledEvent, env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(runNightlyJobs(env as App.Platform['env']));
  }
} satisfies ExportedHandler;
```

- [ ] Verify: `npm run build && npx wrangler dev` serves the scaffold page on :8787. Commit.

### Task 2: Drizzle schema + migrations (TDD at DB level)

**Files:** Create `src/lib/server/db/schema.ts`, `src/lib/server/db/index.ts`, `drizzle.config.ts`, `tests/unit/db.test.ts`; generated `drizzle/0000_*.sql` + hand-written `drizzle/0001_rsvp_seat_trigger.sql`.

**Produces:** tables `events, locations, invitations, rsvps, audit_log, outbox, rate_limits` (+ Better Auth tables in Task 4); `getDb(d1: D1Database)` returning drizzle instance; test factory `testDb()` using better-sqlite3 running all migration SQL files.

Schema exactly as spec §5 (JSON columns via `text({ mode: 'json' })`, timestamps ISO strings, `slug` unique, `token` unique, indexes on `invitations.event_id`, `locations.event_id`). Status/kind constraints as SQL CHECKs in migration. Cross-table seat ceiling as SQLite TRIGGERs:

```sql
-- drizzle/0001_rsvp_seat_trigger.sql
CREATE TRIGGER rsvp_seats_max_insert BEFORE INSERT ON rsvps
WHEN NEW.confirmed_seats > (SELECT max_seats FROM invitations WHERE id = NEW.invitation_id)
BEGIN SELECT RAISE(ABORT, 'seats_exceed_allowance'); END;
CREATE TRIGGER rsvp_seats_max_update BEFORE UPDATE ON rsvps
WHEN NEW.confirmed_seats > (SELECT max_seats FROM invitations WHERE id = NEW.invitation_id)
BEGIN SELECT RAISE(ABORT, 'seats_exceed_allowance'); END;
```

- [ ] Failing tests: insert event+invitation; rsvp with seats ≤ max passes; seats > max throws `seats_exceed_allowance`; duplicate slug throws; FK cascade delete
- [ ] `drizzle-kit generate`, add trigger migration, wire `testDb()` to execute all `drizzle/*.sql` in order
- [ ] Tests green; commit `feat: data model with seat-ceiling trigger`

### Task 3: Core crypto + services (pure TDD)

**Files:** Create `src/lib/server/crypto.ts`, `src/lib/server/services/rsvp.ts`, `services/invitations.ts`, `services/audit.ts`, `tests/unit/{crypto,rsvp,invitations}.test.ts`.

**Produces:**
- `generateToken(bytes=16): string` — base58, rejection sampling (no modulo bias), ~22 chars
- `newId(): string` — 12-byte base58 id
- `pbkdf2Hash(password) / pbkdf2Verify(hash, password)` — format `pbkdf2$100000$salt$hash` (WebCrypto, constant-time compare)
- `submitRsvp(db, {token, attending, seats, note}) → {ok:true, rsvp} | {ok:false, error: 'not_found'|'revoked'|'not_live'|'seats_exceed_allowance'|'invalid'}` — token lookup joins event; attending=false forces seats=0; attending=true requires 1..max_seats; **upsert** (one row per card); writes audit row
- `createInvitations(db, eventId, rows: {guestLabel, maxSeats, phone?, lang?, groupTag?}[]) → Invitation[]` (bulk, tokens generated)
- `audit(db, actor, action, entity, entityId, meta?)`

- [ ] Failing tests first: token charset/length/uniqueness/bias sanity (58² distribution smoke), pbkdf2 roundtrip + wrong-password false, rsvp happy yes(2)/no/over-allowance/revoked/re-answer-overwrites (COUNT stays 1), audit rows written
- [ ] Implement minimal; green; commit `feat: tokens, pbkdf2, rsvp + invitation services`

### Task 4: Better Auth wiring (owner password+TOTP, couple magic link)

**Files:** Create `src/lib/server/auth.ts`, `src/lib/server/guards.ts`, `src/routes/api/auth/[...all]/+server.ts` (or hooks mount per installed version), auth tables migration, `src/routes/studio/setup/*`, `src/routes/studio/login/*`, `src/routes/dash/login/*`, `tests/unit/auth.test.ts` (guards + outbox), extend `tests/e2e` later.

**Produces:** `getAuth(env)` per-isolate memoized; `user.role` (`owner`|`couple`) + `couples(user_id, event_id)` scoping table; `requireOwner(locals)` / `requireCouple(locals, eventId)` throwing 403; magic-link `sendMagicLink` → insert into `outbox` (+ Resend if key set); TOTP via twoFactor plugin (QR enroll in setup page); session cookies HttpOnly/Secure/Lax.

Key decisions: custom `password: { hash: pbkdf2Hash, verify: pbkdf2Verify }` (Workers CPU budget); magic link expiry 15 min single-use (plugin option); owner bootstrap at `/studio/setup?token=$SETUP_TOKEN` — creates the single owner account then self-disables (404 once an owner exists).

- [ ] Generate Better Auth drizzle schema (`@better-auth/cli generate`), merge into schema.ts, `drizzle-kit generate`
- [ ] Failing tests: guards 403 without session / wrong role / cross-event couple; magic link lands in outbox with 15-min expiry
- [ ] Wire hooks.server.ts: auth handler + `event.locals.session/user` population
- [ ] Green; manual check: `/studio/setup` enrolls owner incl. TOTP QR, login works at `/studio/login` (password → TOTP code); commit. **Fallback trigger:** >90 min of Workers/D1 incompat → hand-rolled (sessions table + WebCrypto TOTP), same guards interface.

### Task 5: CI skeleton

**Files:** Create `.github/workflows/ci.yml`.

- [ ] typecheck → lint → vitest → build → (playwright job added Task 21). Commit. (Push to GitHub = manual follow-up, no `gh` on machine.)

### Task 6: i18n (ar RTL / fr / en)

**Files:** Create `src/lib/i18n/{en,fr,ar}.json`, `src/lib/i18n/index.ts`, `tests/unit/i18n.test.ts`.

**Produces:** `t(lang: 'ar'|'fr'|'en', key: string, params?: Record<string,string|number>): string`; `dirFor(lang) → 'rtl'|'ltr'`; `pickLang(invitation.lang, event.languages, acceptLanguageHeader) → lang`. All guest-facing strings live in these files (cover open button, RSVP labels, validation messages, confirmation, countdown units, privacy note).

- [ ] Failing tests: key-set equality across the 3 files (the spec's completeness test), param interpolation, pickLang precedence (invitation override → event default → accept-language)
- [ ] Green; commit `feat: trilingual i18n with completeness guarantee`

### Task 7: Theme schema + 2 presets

**Files:** Create `src/lib/themes/schema.ts` (Zod), `src/lib/themes/presets.ts`, `tests/unit/theme.test.ts`.

**Produces:** `ThemeSchema` Zod object: `{ preset: string, colors: {bg, text, accent, muted}, fonts: {display, body}, slideOrder: SectionId[], musicKey?: string, monogram?: string, texts?: partial overrides }`; `SectionId = 'hero'|'countdown'|'locations'|'schedule'|'rsvp'|'closing'`; `parseTheme(json) → Theme` (safe defaults on missing keys); presets `classic` (light, serif) and `midnight` (dark, gold accent).

- [ ] Failing tests: parse defaults, invalid slideOrder rejected, presets validate
- [ ] Green; commit

### Task 8: Public invitation route (token → personalized page) + caching

**Files:** Create `src/routes/e/[slug]/i/[token]/+page.server.ts`, `+page.svelte` (shell only this task), `src/lib/server/services/events.ts`, `tests/unit/events.test.ts`.

**Produces:** `loadInvitationPage(db, slug, token) → { event, locations[], invitation: {guestLabel, maxSeats, lang}, rsvp? } | null` (revoked/draft → null); page load sets `Cache-Control: public, max-age=0, s-maxage=300, stale-while-revalidate=86400` for live events, `no-store` otherwise; `noindex` meta + `X-Robots-Tag`; OpenGraph tags (title = couple names, description = date, no token echoed in og:url); invalid token → themed graceful 404 (i18n).

RSVP state is NOT baked into cached HTML: the RSVP section hydrates current state from `GET /api/rsvp/[token]` (`no-store`) client-side; SSR fallback = blank form (progressive enhancement, upsert makes re-submit safe).

- [ ] Failing tests: loader shape, revoked→null, draft→null, live→data with per-invitation lang
- [ ] Green; commit

### Task 9: Cover + persistent AudioPlayer (hard constraint #2)

**Files:** Create `src/lib/components/AudioPlayer.svelte`, `src/lib/components/sections/Cover.svelte`; modify `+page.svelte`; create `src/routes/api/audio/[key]/+server.ts`; fixture `tests/fixtures/silence.mp3`.

**Behavior contract (from spec §3.1):**
- Cover: full-screen, couple names + date + `guest_label`, single primary button (i18n "Open Invitation"); nothing else; no audio before tap.
- Tap: sets `<audio src>` (element exists from mount with `preload="none"`, `loop`), `await audio.play()` inside the gesture handler, cover fades out (Svelte transition), scroll unlocked.
- Audio element lives in `+page.svelte` OUTSIDE the scroll-snap container; never re-mounted; floating mute/unmute button fixed bottom-right on all slides (aria-label i18n); `visibilitychange` → pause/resume; `play()` rejection → stay silent, still open slides.
- No music key on theme → no audio element, cover still works.
- `/api/audio/[key]`: streams R2 object, `Content-Type: audio/mpeg`, `Cache-Control: public, max-age=31536000, immutable`, supports Range; 404 if binding/key missing.
- [ ] Playwright micro-spec (added to e2e now, run headed locally): open token URL → cover visible, `audio.paused===true` → click open → `audio.paused===false` and cover gone → mute toggles `audio.muted`
- [ ] Implement; spec green in Chromium; commit

### Task 10: Slide sections + scroll-snap shell

**Files:** Create `sections/Hero.svelte, Countdown.svelte, Locations.svelte, Schedule.svelte, Closing.svelte`; modify `+page.svelte` to render `theme.slideOrder` inside `scroll-snap-type: y mandatory` container; entrance transitions via IntersectionObserver action `src/lib/actions/inview.ts`.

**Contracts:** each section = full-viewport (`100dvh`, `scroll-snap-align: start`), pure props (event/theme/i18n), no fetches; Countdown ticks to `date_main` (Intl per lang, RTL-safe); Locations renders 0..n typed entries each as `maps_url` plain link (spec: no Maps API) with kind icon + localized label + `starts_at`; Schedule from `dates_extra`; respects `prefers-reduced-motion` (transitions off); works with JS disabled (sections stack, form still posts).

- [ ] Implement with frontend-design skill for aesthetics; manual check all 3 languages incl. `dir=rtl`; commit

### Task 11: RSVP form action + Turnstile + rate limit (TDD)

**Files:** Create `sections/RsvpForm.svelte`, form action in `+page.server.ts`, `src/routes/api/rsvp/[token]/+server.ts` (GET state, POST for future check-in PWA), `src/lib/server/turnstile.ts`, `src/lib/server/ratelimit.ts`, `tests/unit/{ratelimit,turnstile}.test.ts`.

**Contracts:**
- Form: attending yes/no radio; seat stepper 1..max_seats (hidden when "no"); note ≤500 chars; works no-JS (`use:enhance` progressive); confirmation + "answered on X, you can change" state after submit.
- Action: Zod parse → `verifyTurnstile(secret?, token, ip)` (skip+warn if secret unset; test keys in dev) → `rateLimit(db, key, {limit:10, windowSec:3600})` per-IP and per-token → `submitRsvp` → redirect/self with success. Errors mapped to i18n messages.
- `rateLimit`: D1 table `rate_limits(key, count, reset_at)` fixed-window upsert, returns `{allowed, retryAfter}`; opportunistic cleanup of expired rows.
- [ ] Failing unit tests: window rollover, limit breach, turnstile skip-when-unset + verify-called-when-set (fetch mocked)
- [ ] Green; Playwright: submit yes(2) → GET /api/rsvp/[token] shows it; resubmit no → overwritten (COUNT 1); commit

### Task 12: Seed + demo wedding (Phase 1 exit)

**Files:** Create `tests/seed/seed.ts` (+ `npm run seed` script: applies local migrations, inserts demo event `demo-wedding` with 2 presets-worth of data, 5 invitations incl. an Arabic-lang card, uploads `silence.mp3` to local R2 via wrangler, prints token URLs).

- [ ] `npm run seed && npx wrangler dev` → open printed URL: cover→music→3 languages→RSVP persists (manual + screenshot via Playwright)
- [ ] Phase 1 exit criteria from spec verified; commit

### Task 13: Studio — event CRUD + locations editor

**Files:** Create `src/routes/studio/+layout.server.ts` (requireOwner), `studio/+page.*` (event list + create), `studio/events/[id]/+page.*` (edit core fields, status draft→live→archived, payment_status pending/deposit/paid), locations sub-editor (add/remove/reorder typed entries), `services/events.ts` extensions, `tests/unit/events-crud.test.ts`.

- [ ] TDD service fns: `createEvent` (slug uniqueness, default theme+languages), `updateEvent` (Zod-validated patch + `updatedAt` + audit), `setStatus`, location CRUD with sort
- [ ] Green; manual: create event in browser; commit

### Task 14: Studio — theme editor + live preview + audio upload (the only upload)

**Files:** Create `studio/events/[id]/theme/+page.*` (JSON-backed form: preset picker, colors, fonts, slide order, texts) with iframe live preview of `/e/[slug]/preview` (owner-session-gated preview route bypassing cache), `studio/events/[id]/audio/+page.*` (single `<input type=file accept="audio/*">` → form action streams to R2 `audio/{eventId}.mp3`, 8 MB Zod cap, sets `theme.music_key`; licensing note text from spec §3.1.6 displayed), delete-track button.

- [ ] Manual verify: change color → preview updates; upload mp3 → guest page plays it. **Grep guard test** (unit): no other `type="file"` input exists in `src/` (hard constraint #1 enforcement, checked by test `tests/unit/no-photo-upload.test.ts`)
- [ ] Commit

### Task 15: Studio — bulk import, links, QR, wa.me (TDD on CSV)

**Files:** Create `src/lib/server/csv.ts` (RFC-4180 subset parser: quoted fields, commas, CRLF, `guest_label,max_seats,phone,lang,group_tag` header-row mapping), `studio/events/[id]/guests/+page.*` (textarea paste or file → preview table → confirm import; list existing cards: token URL copy button, QR (client-side `uqr` SVG), `wa.me/{phone}?text={greeting+link}` link, revoke toggle, per-card lang/seats edit), `tests/unit/csv.test.ts`.

- [ ] Failing tests: quoted commas, Arabic text, CRLF, bad seat count row → per-row error not batch abort
- [ ] Green; manual: import 10 rows incl. quoted commas + Arabic; QR renders; commit

### Task 16: Couple dashboard + magic link + CSV export

**Files:** Create `dash/login/*` (email → magic link; if no email driver: "the owner will send your link" i18n note), `dash/[event]/+page.*` (guard requireCouple: summary tiles — invited cards, confirmed seats, declined, pending; filterable table name/status/group; per-invitation state), `src/routes/api/events/[id]/export.csv/+server.ts` (owner or that event's couple; UTF-8 BOM for Excel Arabic), `services/export.ts`, `tests/unit/export.test.ts`; studio button "generate couple login" (creates couple user bound to event + magic link in outbox).

- [ ] TDD: aggregate query fns (`eventStats`, `rsvpRows` with filters), CSV export escaping + BOM; cross-tenant: couple of event A requesting event B → 403
- [ ] Green; manual magic-link flow from outbox URL; commit

### Task 17: Audit log surface

**Files:** Create `studio/events/[id]/activity/+page.*` (paged audit rows for the event), ensure services write audit on: event create/update/status, invitation create/revoke, rsvp submit (actor = `token:xxx` prefix), audio upload, export, magic-link issue.

- [ ] Unit assert: each service writes expected audit row (covered partly in earlier tests — fill gaps); commit

### Task 18: Security headers + healthz

**Files:** Modify `src/hooks.server.ts`: CSP `default-src 'self'; script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; media-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; connect-src 'self' https://challenges.cloudflare.com`, HSTS, `Referrer-Policy: same-origin`, `X-Content-Type-Options: nosniff`, `Permissions-Policy` minimal; create `src/routes/api/healthz/+server.ts` (D1 `SELECT 1` + version json, `no-store`); `tests/unit/headers.test.ts` via a handle() invocation.

- [ ] TDD handle wrapper; green; verify Turnstile still loads under CSP; commit

### Task 19: Cron jobs — nightly backup to R2 + retention purge

**Files:** Create `src/lib/server/jobs.ts`, `tests/unit/jobs.test.ts` (better-sqlite3 db + in-memory R2 stub).

**Contracts:** `runNightlyJobs(env)`: (1) dump each table as JSON lines to `backups/YYYY-MM-DD/{table}.jsonl` in R2 (+ `manifest.json` with counts); (2) retention: events with `date_main + retention_months` past AND status != archived → archive + delete guest PII (invitations.phone, guest_label → 'purged', rsvps.note) writing audit row `retention_purge`; (3) delete expired outbox/verification/rate_limit rows. Wrapper from Task 1 calls this on cron.

- [ ] Failing tests: backup writes all tables + manifest counts; purge only past-retention events; PII gone, aggregates remain
- [ ] Green; `npx wrangler dev --test-scheduled` + `curl "http://localhost:8787/__scheduled?cron=0+2+*+*+*"` writes to local R2; commit

### Task 20: Error capture (Sentry-compatible, env-gated, zero client bundle cost)

**Files:** Create `src/lib/server/sentry.ts` (POST to Sentry envelope endpoint when `SENTRY_DSN` set; no-op otherwise), wire `handleError` server hook (event id returned to user page) + client `handleError` in `src/hooks.client.ts` → `navigator.sendBeacon('/api/log')` → server forwards; create `src/routes/api/log/+server.ts` (rate-limited, 1 KB cap). **Deviation note:** spec names Sentry SDKs; envelope API keeps guest bundle at 0 KB — same Sentry account/alerts. Recorded in plan + runbook.

- [ ] Unit: DSN parsing → envelope URL; no-op without DSN; commit

### Task 21: Playwright E2E suite (the 7 spec scenarios)

**Files:** Create `tests/e2e/{guest-flow,guest-decline,invalid-token,couple-login,owner-lifecycle,export,cross-tenant}.spec.ts`, `playwright.config.ts` (webServer: `npm run build && npm run seed:e2e && wrangler dev --port 8787`; projects: Chromium desktop + WebKit iPhone profile), `tests/seed/seed-e2e.ts` (deterministic fixtures incl. owner + couple users).

Scenarios (from spec §4.14): ① token → cover → start (assert `!audio.paused`) → swipe all slides → RSVP yes(2) → couple dashboard reflects; ② decline flow; ③ invalid + revoked token → graceful themed page; ④ couple magic-link login (read link from outbox via studio); ⑤ owner creates event + imports 50 rows → 50 links; ⑥ export CSV matches DB rows; ⑦ cross-tenant access → 403.

- [ ] All green Chromium + WebKit mobile; wire into CI as second job; commit

### Task 22: Performance pass (Phase 3 exit)

- [ ] `npm run build` → inspect client bundle for invitation route (budget: < 40 KB gzip JS total); Lighthouse (via Playwright chromium `--throttling` or `lighthouse` CLI if available) on seeded page, mobile profile: perf ≥ 90, a11y ≥ 90; fix regressions (font subsetting, preload cover assets). Commit.

### Task 23: Local verification (gate before production)

- [ ] `npm run check` (svelte-check), `npm run lint`, `npx vitest run` all green — paste outputs
- [ ] `npx playwright test` green both projects — paste summary
- [ ] Manual smoke on `wrangler dev`: all three surfaces + audio + RTL + mute + no-JS RSVP (`curl -d` form post)
- [ ] Mark Task 6 (tracker) complete only with evidence

### Task 24: Cloudflare provisioning (USER-INPUT GATE)

- [ ] Ask user to run `! npx wrangler login` (or provide `CLOUDFLARE_API_TOKEN`)
- [ ] `npx wrangler d1 create einvite-db` → paste `database_id` into wrangler.jsonc
- [ ] `npx wrangler r2 bucket create einvite-media` (if R2 not enabled on account → guide user through one-time dashboard enable; binding stays, audio degrades gracefully meanwhile)
- [ ] `npx wrangler d1 migrations apply einvite-db --remote`
- [ ] Secrets: `BETTER_AUTH_SECRET` (generated 32B), `SETUP_TOKEN` (generated, shown to user once), optional `TURNSTILE_SECRET`+site key (real widget = 2-min dashboard task; test keys until then), `SENTRY_DSN` if user has one
- [ ] `vars.PUBLIC_BASE_URL` → workers.dev URL

### Task 25: Deploy + production smoke

- [ ] `npx wrangler deploy` → note URL `https://einvite.<account>.workers.dev`
- [ ] Smoke: `/api/healthz` 200; `/studio/setup?token=…` → create owner + TOTP; create real demo event + 2 invitations; open token URL on phone-sized viewport; RSVP round-trip; check `wrangler tail` clean
- [ ] Verify cron registered (`wrangler deployments` / dashboard); trigger one manual backup via `--test-scheduled` against remote? (not possible remotely — verify next-morning backup object exists: runbook item)

### Task 26: Runbook + go-live checklist

**Files:** Create `docs/runbook.md`: restore from R2 backup / D1 Time Travel, purge cache, revoke token, resend magic link, rotate SETUP_TOKEN, enable real Turnstile keys, attach custom domain (registrar → CF zone → route), UptimeRobot setup on `/api/healthz`, GitHub repo + Actions activation, quarterly `rclone` media pull, Workers Paid $5 trigger conditions.

- [ ] Write; final commit; summarize deliverable to user with URLs + manual follow-ups

---

## Self-Review (run after writing — completed 2026-07-26)

1. **Spec coverage:** §3.1 cover/music/slides → T9/T10; §4.4 auth matrix → T4; §4.6 REST endpoints → T11/T16; §4.7 caching → T8; §4.9 audio-only R2 → T14 (+ no-photo grep guard); §4.10 waitUntil/cron → T19; §4.13 monitoring → T18/T20 (UptimeRobot manual, runbook); §4.14 test strategy → T2/T3/T11/T21; §5 schema → T2; §7.2 controls → T8/T11/T18; §7.3 retention → T19; §7.4 backups → T19/T26; §8 wa.me/OG/RTL/per-card lang → T6/T8/T15. Deferred items (check-in PWA, photo pipeline, WhatsApp API, reminders automation) correctly NOT planned — triggers not fired. Studio "trigger reminders" (§3) = wa.me links per pending card in T15 list (manual send), matching §8's no-API rule.
2. **Placeholder scan:** none (behavior contracts are exact; full markup intentionally delegated to implementation with frontend-design skill — acceptable because executor = author).
3. **Type consistency:** `getDb`, `submitRsvp` result union, `requireOwner/requireCouple`, `rateLimit` signature, `runNightlyJobs(env)` consistent across tasks. `music_key` lives in `theme` JSON (schema §5 comment) — T7/T9/T14 agree.
