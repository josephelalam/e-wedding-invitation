# EInvite Runbook

One page for the owner-operator. Commands assume the repo root and Node 22
(`nvm use`). Remote commands need `npx wrangler login` once per machine.

## Daily driving

| Task                        | How                                                                       |
| --------------------------- | ------------------------------------------------------------------------- |
| New wedding                 | Studio → Events → New event → fill → **Go live** when ready               |
| Import guests               | Studio → event → Guests → paste `name, seats, phone, lang, group` lines   |
| Share a card                | Guests tab → Copy link / WhatsApp / QR per card                           |
| Couple dashboard access     | Guests tab → "Create sign-in link" → forward from **Outbox** via WhatsApp |
| Change music                | Studio → event → Music (MP3/AAC ≤ 8 MB; keep it licensed/royalty-free)    |
| Record payment              | Studio → event → Details → Payment (pending / deposit / paid)             |
| "My aunt swears she RSVP'd" | Studio → event → Activity (every submission is logged)                    |

## Incidents

**Site down during a blast window** (UptimeRobot alert on `/api/healthz`):

1. `npx wrangler tail einvite` — look at live errors.
2. Cloudflare dashboard → Workers → einvite → rollback to the previous
   deployment (~30 s), or `git revert` + `npm run deploy:prod`.

**Prank / spam RSVPs on one card**: Studio → event → Guests → **Revoke** that
card (the link dies instantly; re-activate later if it was a mistake).
Rate limits already cap per-IP (30/h) and per-card (10/h) writes.

**A guest says the page won't open**: check the exact link (token is
case-sensitive), the event is **live**, and the card isn't revoked.

## Restore

- **≤ 30 days, point-in-time**: `npx wrangler d1 time-travel restore einvite-db --timestamp=<unix>`
- **From nightly dump** (R2, `backups/YYYY-MM-DD/*.jsonl` + `manifest.json`):
  `npx wrangler r2 object get einvite-media/backups/<date>/<table>.jsonl` per
  table, convert JSONL → INSERTs, apply with `npx wrangler d1 execute einvite-db --remote --file …`.
  Each line is one row with DB column names.
- **Media**: R2 is the primary copy; pull quarterly to local disk:
  `rclone sync r2:einvite-media ./media-backup` (or `wrangler r2 object get` per key).

Backups run at 02:00 UTC nightly (Cron Trigger). Verify the morning after the
first deploy: `npx wrangler r2 object get einvite-media/backups/<today>/manifest.json`.

## Secrets & config

| Item                                             | Where                     | Notes                                                                                                                                                               |
| ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BETTER_AUTH_SECRET`                             | `npx wrangler secret put` | rotate = all sessions log out                                                                                                                                       |
| `SETUP_TOKEN`                                    | secret                    | only used until the owner account exists; rotate/remove after                                                                                                       |
| `TURNSTILE_SECRET` + `PUBLIC_TURNSTILE_SITE_KEY` | secret + var              | create a widget (dashboard → Turnstile, free); until set, RSVP relies on rate limits only. Note: with Turnstile ON, no-JS guests cannot RSVP (documented trade-off) |
| `SENTRY_DSN`                                     | secret                    | optional; error capture is a no-op without it (lite envelope client, no SDK bundle — deviation from spec §4.13 for guest bundle weight)                             |
| `RESEND_API_KEY`                                 | secret                    | optional; magic links always land in the Outbox regardless                                                                                                          |
| `ORIGIN`                                         | var in `wrangler.jsonc`   | must match the public URL exactly (auth cookies + magic links)                                                                                                      |

## Custom domain (when bought)

1. Add the zone to the same Cloudflare account, or transfer DNS.
2. Workers → einvite → Settings → Domains & Routes → add `invite.example.com`.
3. Update `vars.ORIGIN` in `wrangler.jsonc` → `npm run deploy:prod`.
4. Update UptimeRobot monitor URL.

## Monitoring

- **UptimeRobot** (manual, free): HTTPS monitor on `https://<app>/api/healthz`,
  5-min interval, keyword `"ok":true`, alert → email/Telegram.
- **Cloudflare dashboard** → Workers analytics: requests, errors, CPU — answers
  "how many guests opened it".
- **Sentry**: set `SENTRY_DSN` and errors arrive tagged `source:server|client`.

## Retention & privacy (Law 81/2018 posture)

Guest PII is purged automatically N months after the event date (default 6,
per-event setting in Details): guest labels become `purged`, phones and notes
are deleted, seat totals survive. Manual erasure request: revoke the card, then
run the same purge early by lowering the event's retention months.

## Development

```bash
npm install && npm run db:migrate:local && npm run seed   # demo wedding + URLs
npm run dev            # vite dev (fast HMR, port 5173)
npm run build && npm run preview   # real Workers runtime (port 4173)
npx vitest run         # 125 unit tests (real migration SQL via better-sqlite3)
npx playwright test    # e2e vs seeded wrangler dev (chromium + iPhone WebKit)
```

WebKit browsers need system libs once per machine: `sudo npx playwright install-deps`.

## Cost triggers (from the architecture doc §9)

$0/month until: Workers >100k req/day or CPU limits bite → Workers Paid $5/mo;
R2 >10 GB (≈ decades of audio) → $0.015/GB·mo. Everything else stays free.
Full decision records + revisit triggers: `architecture-einvitation-platform.md`.
