# EInvite — managed e-invitation platform

Trilingual (ar/fr/en) wedding & event e-invitations for the Lebanese market,
run as a managed side business: the owner builds each event, guests open a
music-backed envelope from a personal WhatsApp link, couples track RSVPs live.

- **Architecture (authoritative):** [`architecture-einvitation-platform.md`](./architecture-einvitation-platform.md)
- **Operations:** [`docs/runbook.md`](./docs/runbook.md)
- **Stack:** SvelteKit (Svelte 5) on Cloudflare Workers · D1 + Drizzle · R2 · Better Auth · $0/month

## Surfaces

| URL                   | Who     | What                                                                             |
| --------------------- | ------- | -------------------------------------------------------------------------------- |
| `/e/{slug}/i/{token}` | guests  | cover → music → swipeable slides → RSVP (no account; the link is the credential) |
| `/dash`               | couples | magic-link login → live RSVP dashboard + CSV export                              |
| `/studio`             | owner   | password+TOTP → events, themes, guests, outbox, audit                            |

## Quick start

```bash
nvm use && npm install
npm run seed          # local D1 migrations + demo wedding (prints guest URLs)
npm run build && npm run preview   # real Workers runtime on :4173
```

First production deploy: see the checklist in `docs/runbook.md` (wrangler
login → D1/R2 create → secrets → `npm run deploy:prod` → `/studio/setup`).

## Hard constraints (owner-mandated)

1. **No photo uploads anywhere** — the only upload in the system is one audio
   track per event (enforced by a unit test).
2. **Music-on-open** guest experience — the open button is the audio unlock.
3. **~$0/month** — Cloudflare free tiers only; the domain is the only bill.
