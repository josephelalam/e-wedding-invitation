# Technical Architecture Document

## Managed Wedding E‑Invitation Platform — Lebanon

**Version:** 1.1 · **Status:** Approved for implementation · **Prepared by:** Independent architecture review
**Operating model:** Owner-managed (agency style) · **Year‑1 scale:** < 25 weddings · **Market:** Lebanon (+ diaspora guests)

> **How to use this file:** This is the authoritative project reference for AI-assisted implementation (e.g., Claude Code). Follow the decisions, scope boundaries, and hard constraints exactly; anything marked _deferred_ must not be built until its written trigger fires.

### Hard constraints (owner-mandated — override everything else)

1. **No photo uploading** anywhere in the MVP — no studio image pipeline, no gallery uploads, no guest photo wall. Invitation imagery, if any, is placed manually by the owner as theme assets (§4.9).
2. **Music-on-open guest experience** — a welcome/cover page with a start button that triggers the wedding's background music and unlocks a swipeable, slide-based invitation (full spec in §3.1).
3. **Near-zero cost** — $0/month infrastructure; the only mandatory spend is the domain (~$10–12/yr). No paid service may be introduced unless the app cannot run without it.

---

## 1. Executive Summary

This document specifies the architecture for a multi-tenant digital wedding invitation platform operated as a side business. The owner builds each wedding site for the couple (managed model). Couples receive a private dashboard to track RSVPs. Guests receive personalized invitation links, each carrying a name and a seat allowance (e.g., "Elie + guest — 2 seats"), and confirm attendance without creating an account.

The recommended architecture is deliberately boring: **a single SvelteKit application, written in TypeScript, deployed on Cloudflare Workers, backed by Cloudflare D1 (SQLite) via Drizzle ORM, with media on Cloudflare R2**. Public invitation pages are prerendered/edge-cached; the couple dashboard and owner studio are server-rendered, authenticated routes in the same app. Guests experience the invitation as a themed cover page whose "open" button starts the couple's music and reveals swipeable full-screen slides — the digital analogue of opening an envelope.

**Headline numbers:** fixed infrastructure cost at launch is **$0/month plus ~$10–12/year for the domain**. The first paid trigger is Cloudflare Workers Paid at $5/month, which this project is unlikely to hit in year one. The system comfortably absorbs the real traffic shape of this business — short, sharp bursts of a few hundred guests within hours of a WhatsApp blast — because guest pages are served as cached static assets from Cloudflare's CDN, including to diaspora guests in Europe, the Gulf, and the Americas.

Several technologies commonly assumed for this kind of project — React, Node.js servers, MongoDB, Redis, a search engine, a message queue, microservices — were evaluated and **rejected on the merits** for this requirement set. Section 2.3 explains each rejection.

---

## 2. Requirements Analysis

### 2.1 Functional requirements (from project description)

- Per-couple customizable invitation website (design, texts, music track, owner-placed imagery — no upload UI, per hard constraint #1).
- Event data: groom's house location, bride's house location, church location, restaurant/celebration venue location, plus date(s) and times.
- Named invitations created by an admin, each with a **maximum seat count** (the "2 people on one card" rule).
- Guest-facing RSVP: attending / not attending, with confirmed seat count ≤ allowance.
- Couple dashboard: live list of who answered, seat totals, pending invitations.
- Guest experience: a welcome/cover page with the guest's name and a start button; pressing it starts the wedding's background music and opens a swipeable slide sequence (details, locations, RSVP). Music keeps playing across slides with a visible mute toggle.
- Owner (super-admin) creates and manages every wedding, its theme, its music track, and its invitation list.
- Go-live as a commercial side business.
- **Explicitly out of scope (MVP):** photo uploading of any kind — owner-side pipeline, gallery, or guest photo wall — and any feature that requires a paid service.

### 2.2 Derived non-functional requirements

**Traffic shape.** ~25 weddings/year × ~250–400 invitation cards ≈ 6,000–10,000 invitations/year, each representing 1–3 page views plus one RSVP write. Traffic is **extremely bursty**: the moment a couple blasts the link on WhatsApp, 200–500 guests open it within a few hours; between weddings, traffic is near zero. Peak day estimate: ~3,000–8,000 page views, ~500 RSVP writes. This is trivial for an edge CDN and would be a poor fit for anything that scales by keeping servers warm.

**Data volume.** Year-one database size is measured in **single-digit megabytes** (≈10k invitation rows, ≈10k RSVP rows, tens of event rows). Any database evaluated here is overkill by three orders of magnitude; the selection criteria are therefore cost, operational burden, and integration — not raw capability.

**Latency profile.** Guests are mobile-first, often on 4G, split between Lebanon and the Lebanese diaspora (Europe, Gulf, West Africa, Americas). Static-first delivery from a global CDN matters more than compute location. Writes (RSVPs) tolerate 100–300 ms happily.

**Availability.** An invitation page being down during the blast window is direct business damage. Target: no single machine whose reboot takes the product offline; automated uptime alerting.

**Team & operations.** One person, part-time, who also does sales and customer onboarding. Every architectural decision is weighted toward **near-zero operations**: no servers to patch, no databases to vacuum, no certificates to renew.

**Cost constraint (hard).** Fixed infrastructure must be ~$0/month; the domain is the only accepted mandatory cost. Consequences are structural: free-tier-only services whose terms permit commercial use, no Google Maps JavaScript API key (location _links_ instead of embedded maps), no paid image/messaging APIs, and every paid capability parked behind a written trigger.

**Payments constraint.** Stripe and most card processors do not operate in Lebanon. Couples pay the owner offline (cash, bank/OMT/Whish transfer). Therefore **no billing engine is in scope**; the owner records payment status manually. This removes an entire subsystem that generic SaaS architectures assume.

**Localization.** Trilingual reality: Arabic (RTL), French, English — often mixed within one guest list. i18n and RTL are day-one requirements, not add-ons.

### 2.3 Challenged assumptions

Per the brief, I challenge the following before any technology is chosen:

**"Use React / Node.js / MongoDB."** Not selected. React's advantages (ecosystem depth, hiring pool, job-market familiarity) do not apply to a solo side business, while its costs do: the largest runtime bundle of the mainstream frameworks, which directly hurts guests opening invitation pages on 4G. MongoDB is a document store aimed at flexible/nested high-volume data; this domain is small, strictly relational (events → invitations → RSVPs, with integrity rules like `confirmed_seats ≤ max_seats`), and MongoDB's official driver does not run on edge runtimes, which would force a heavier hosting tier. A persistent Node.js server is an operational liability at this scale: it is the thing that gets rebooted, runs out of memory, or needs patching at 2 a.m. before someone's wedding. Each is re-examined in its own decision record below.

**"Four fixed location fields."** Rejected as a schema. Lebanon's market is religiously mixed: church weddings, mosque ceremonies, civil ceremonies abroad, and multi-venue days are all common, and some couples will not want a "groom's house" stop at all. Locations are modeled as an **ordered, typed list** (`house_groom`, `house_bride`, `ceremony`, `reception`, `other`) with 0–n entries. The four fields from the brief become the default template, not a constraint.

**"It's a wedding product."** Narrower than the asset being built. Every mechanism here — themed event page, tokenized cards with seat allowances, RSVP dashboard — applies unchanged to engagements, baptisms, birthdays, and corporate events. The schema says `events`, not `weddings`; wedding-ness lives in the theme layer. This multiplies the addressable market of the same codebase at zero extra cost.

**"A platform needs platform infrastructure."** The strongest temptation to resist. At <25 events/year with a managed onboarding model, there is no self-serve signup, no billing engine, no template marketplace, and no scale that justifies distributed anything. The correct architecture is a **modular monolith** with ruthless scope discipline; every rejected component (queue, cache server, search engine) is documented below with the trigger that would justify revisiting it.

---

## 3. System Overview

```
                         ┌──────────────────────────────────────────────┐
                         │            CLOUDFLARE (single vendor)         │
                         │                                              │
 Guest (WhatsApp link) ──┼──► CDN edge cache ──► SvelteKit app (Worker) │
   /e/{event}/i/{token}  │        │                    │                │
                         │   cached HTML          ┌────┴────┐           │
 Couple (dashboard) ─────┼──► auth session ──────►│   D1    │ SQLite    │
   /dash/{event}         │                        │ Drizzle │           │
                         │                        └────┬────┘           │
 Owner (studio) ─────────┼──► auth + TOTP ─────────────┤                │
   /studio               │                             │                │
                         │   music/assets ◄────── R2 (S3-compatible)    │
                         │   nightly backup cron ─► R2 (SQL dumps)      │
                         │   Turnstile (bot check on RSVP writes)       │
                         └──────────────────────────────────────────────┘
        Sentry (errors) · UptimeRobot (external ping) · GitHub Actions (CI)
```

Three route groups, one deployable:

1. **Public renderer** — `/e/{event-slug}/i/{token}`: the invitation page. Theme config (JSON) + event data + the token's guest name and seat allowance produce a personalized, trilingual, slide-based page opened from a music-triggering cover (spec: §3.1). Aggressively cached at the edge; the only dynamic call is the RSVP submission.
2. **Couple dashboard** — `/dash/{event}`: read-mostly. RSVP list, seat totals, pending/declined filters, CSV export. Magic-link login; no password for couples to forget.
3. **Owner studio** — `/studio`: create events, edit theme JSON with live preview, bulk-import invitation lists (CSV/paste), generate per-card links and QR codes, record payment status, trigger reminders.

Guests never authenticate. **The token is the capability**: possession of the unguessable link _is_ the permission to view and RSVP for that card, which matches how invitations socially work (they are forwarded, not logged into).

### 3.1 Guest experience specification — cover, music, slides (hard constraint #2)

The invitation behaves like an envelope, not a webpage:

1. **Cover page (the "envelope").** Full-screen themed cover with the couple's names, the date, and the guest label from the token ("Dear Elie & Maya"). One primary button — افتح الدعوة / _Ouvrir l'invitation_ / _Open Invitation_. Nothing else competes for attention; no audio has played yet.
2. **The button is the audio unlock.** Browsers — iOS Safari especially — block audio until a user gesture; the start button _is_ that gesture, a platform restriction turned into ceremony. On tap: create the `<audio>` element (`loop`, `preload="none"` until tap), start playback, transition the cover away.
3. **Slides.** Full-viewport sections navigated by swipe/scroll, implemented with CSS `scroll-snap` (native momentum, zero JS for navigation itself) plus `IntersectionObserver`-driven Svelte entrance transitions per slide. Default order (theme-configurable): names/monogram → date + countdown → locations (0..n, each an "Open in Google Maps" link) → day schedule → RSVP → closing message. The RSVP remains a progressive-enhancement form: it must submit even where JS fails.
4. **Persistent audio control.** A floating mute/unmute toggle on every slide. One `<audio>` element lives _outside_ the scroll container and is never re-mounted, so playback continues across slides. Pause on `visibilitychange` (tab hidden), resume on return. If a guest bypasses the cover (deep link, crawler), the page functions silently — music is an enhancement, never a gate to the RSVP.
5. **Audio asset.** One track per event: `events.theme.music_key` → R2 object, MP3/AAC at ~128 kbps (~3–4 MB), `Cache-Control: immutable`, served through the Worker. Uploaded by the owner in the studio — **the only upload control in the entire system** (audio, never photos) — or placed via `wrangler r2 object put`.
6. **Licensing note (documented in the studio UI):** playing commercial pop tracks on a public page carries copyright exposure. Default to royalty-free/licensed instrumental versions; couple-supplied audio is accepted at the couple's responsibility.

---

## 4. Decision Records

Each record states the recommendation, why it fits _this_ project, alternatives and why they were not selected, and the eight required lenses (scalability, performance, development speed, maintainability, cost — plus pros/cons woven through).

### 4.1 Frontend framework — **SvelteKit (Svelte 5, TypeScript)**

**Why best fit.** One framework must serve two very different faces: (a) invitation pages that are essentially beautiful documents — animation-rich, content-heavy, opened once on a mid-range phone over 4G — and (b) two small CRUD dashboards. Svelte compiles away its framework: invitation pages ship a fraction of the JavaScript a React page ships, which is the single biggest controllable factor in mobile load time here. Its built-in transition/animation primitives (`transition:`, `animate:`, springs) are unusually well suited to elegant invitation reveals without pulling a 40 KB animation library. The cover→slides experience (§3.1) maps directly onto CSS scroll-snap plus these primitives, and the persistent audio player is a ~30-line Svelte component — no carousel or audio library required. SvelteKit then covers the dashboards with file-based routing, server `load` functions, form actions (progressive enhancement + CSRF handled), and first-class Cloudflare deployment via an official adapter.

**Alternatives considered.**

| Option                            | Verdict               | Why not selected                                                                                                                                                                                                                                                                   |
| --------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Astro**                         | Very close second     | Best-in-class for the _public_ pages (islands, near-zero JS). But dashboards in Astro mean bolting on an island framework + session/form patterns SvelteKit ships natively. Two mental models for a solo dev; choose Astro only if the dashboard were outsourced to a spreadsheet. |
| **Next.js (React)**               | Rejected              | Largest baseline bundle; App Router/RSC complexity buys nothing at this scale; ecosystem gravity pulls toward Vercel, whose free tier prohibits commercial use. Its strengths (hiring, enterprise ecosystem) are irrelevant to a one-person business.                              |
| **Nuxt (Vue)**                    | Rejected              | Perfectly capable; loses to Svelte on bundle size and built-in motion, with no offsetting advantage for this domain.                                                                                                                                                               |
| **Laravel + Blade/Livewire**      | Respectable rejection | Outstanding CRUD velocity, but implies a PHP server (VPS or paid PaaS), i.e., fixed cost + ops for a product that is idle 300 days/year. Static/edge delivery of guest pages is second-class.                                                                                      |
| **Plain static HTML per wedding** | Rejected              | Tempting at 25 weddings, but RSVP writes, dashboards, and per-guest tokens make each "static" site grow a backend; 25 bespoke sites is the maintenance worst case.                                                                                                                 |

**Scalability:** rendering is static-first; scaling is the CDN's problem, effectively unbounded for this shape. **Performance:** smallest practical JS payload; prerendered HTML paints fast on 4G; Core Web Vitals headroom for heavy imagery. **Dev speed:** one language (TS) and one framework end-to-end; form actions remove a REST layer for dashboard CRUD. **Maintainability:** Svelte 5 is stable; SvelteKit adapters make the app portable (Cloudflare → Node → static) without rewrites; risk = smaller ecosystem than React — acceptable because the component needs (forms, tables, maps embed, lightbox) are commodity. **Cost:** $0 marginal; MIT-licensed. **Cons:** fewer ready-made premium UI kits than React; you will hand-build more of the invitation aesthetics (which is the product's differentiator anyway).

### 4.2 Backend framework/language — **SvelteKit server routes on Cloudflare Workers (TypeScript)**

**Why best fit.** The backend surface is small: resolve token → render page; accept RSVP (validate seats, upsert); dashboard queries; studio CRUD; nightly cron. SvelteKit's server `load`/actions/endpoints running _inside_ the same Worker eliminates an entire tier — no separate API service, no CORS, no duplicate deployment, no schema drift between front and back. TypeScript end-to-end with Zod validation at every boundary gives compile-time and runtime safety with one skill set.

**Alternatives.**

| Option                                 | Why not selected                                                                                                                                                                     |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Separate **Hono** API on Workers       | Clean, fast — but a second deployable, second router, and hand-rolled CSRF/session plumbing for zero benefit until an external consumer exists (see 4.6 trigger).                    |
| **Node.js + Express/Fastify on a VPS** | Reintroduces the 24/7 pet server: patching, memory leaks, PM2, nginx, TLS renewals — the operational profile this design exists to avoid. Justified only past free-tier limits (§9). |
| **Laravel / Rails / Django**           | Superb monolith DX, but each anchors hosting to a paid always-on runtime; admin-panel generators are their killer feature, and the studio here is deliberately small.                |
| **Go / Rust service**                  | Performance this project cannot use; slower iteration for a solo generalist; ecosystem friction for HTML-first rendering.                                                            |

**Constraint to respect:** the Workers free plan allows ~10 ms CPU per request. Cached public pages don't touch compute; dashboard SSR + D1 queries fit comfortably if queries stay indexed and sessions stay lean (verified pattern; the $5 paid plan lifts this if ever breached). **Scalability:** isolates spin up per-request globally; no warm-pool math. **Performance:** sub-5 ms cold starts; DB co-located with compute. **Dev speed:** highest of all options considered — one repo, one deploy. **Maintainability:** boring, typed, single runtime; portable via adapter swap. **Cost:** $0 to start.

### 4.3 Database — **Cloudflare D1 (SQLite) with Drizzle ORM**

**Why best fit.** The data is tiny, relational, and integrity-sensitive. SQLite semantics (foreign keys, CHECK constraints like `confirmed_seats <= max_seats`, transactions) map exactly; D1 adds managed hosting, point-in-time recovery (Time Travel, 30 days), zero egress fees, and native Workers bindings — queries run microseconds from the app with no connection pooling, no PgBouncer, no idle-database pausing. Free tier: 5 GB storage, 5 M rows read/day, 100 K rows written/day — respectively ~1000×, ~500×, and ~200× this project's year-one needs. Drizzle provides typed schema-as-code, SQL-transparent queries, and migration files that are plain SQL (auditable, portable).

**Alternatives.**

| Option                  | Why not selected                                                                                                                                                                                                                                                                                                                   |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **MongoDB Atlas**       | Wrong data model (relational integrity would be reimplemented in app code); official driver requires a TCP/Node runtime, incompatible with the chosen edge tier; free M0 cluster is fine but buys nothing here. Selected earlier in this conversation's history by familiarity — exactly the bias this review was asked to remove. |
| **Supabase (Postgres)** | Excellent product; disqualifying flaw for this business: free-tier projects **pause after ~1 week of inactivity**, and this product has dormant weeks by nature. A paused DB during a surprise invitation blast is unacceptable; paying $25/mo to avoid it fails the cost test.                                                    |
| **Neon (Postgres)**     | Serverless driver works on Workers; autosuspend cold starts (~0.5–1 s) hit exactly the burst-after-idle pattern; adds a second vendor for no capability the domain uses.                                                                                                                                                           |
| **Turso (libSQL)**      | Closest competitor — generous free tier, embedded replicas. Loses on vendor consolidation (one more account/billing/SLA) and D1's in-platform bindings/backup story. Solid fallback if D1 disappoints.                                                                                                                             |
| **Postgres on a VPS**   | Full control, full ops: backups, upgrades, disk monitoring. The premise of this design is that nobody is on call.                                                                                                                                                                                                                  |

**Scalability:** D1 read replication exists when needed; the realistic ceiling (10 GB/db, single-writer) is decades away at this data shape — and the exit is `sqlite3 .dump` into any SQL system. **Performance:** single-digit-ms queries co-located with the Worker. **Dev speed:** Drizzle schema + `drizzle-kit` migrations are minutes-per-change. **Maintainability:** plain SQL migrations in git; local dev is literal SQLite on disk (Miniflare), so tests run with zero services. **Cost:** $0; paid overage pricing is fractions of a dollar at 10× scale. **Cons:** single-region writes (irrelevant: ~500 writes on the busiest day); no stored procedures (unneeded); vendor-specific service — mitigated by standard SQLite format + nightly dumps (§7.4).

### 4.4 Authentication — **Better Auth (sessions in D1); magic links for couples; TOTP-protected owner account; capability tokens for guests**

**Why best fit.** Three principals, three mechanisms matched to their reality:

- **Guests (thousands):** no accounts. A 128-bit random token in the URL is the credential for one card. This is the decisive UX choice — any login on the RSVP path measurably kills response rates — and it satisfies the requirement directly: the card _is_ the identity.
- **Couples (≤25/year):** **magic-link login** (emailed/WhatsApp-forwarded sign-in link). Non-technical users, used for 2–6 months, forgotten forever; passwords here generate support tickets, not security. Session cookie: HttpOnly, Secure, SameSite=Lax.
- **Owner (1):** email + password + **TOTP 2FA**. This account can read every guest list; it gets real protection.

Better Auth is a maintained, framework-agnostic TypeScript auth library with a Drizzle/D1 adapter and plugins covering exactly this matrix (magic link, TOTP) — batteries without a SaaS dependency.

**Alternatives.** **Clerk/Auth0** — polished, but a paid external dependency and heavyweight UI for ~26 human users/year; data residency of guest-adjacent info moves to a third party for no gain. **Auth.js** — OAuth-oriented; credentials/magic-link paths are second-class and D1 support is community-grade. **Hand-rolled sessions** — genuinely viable at this size and the fallback if Better Auth's Workers story regresses; not chosen first because TOTP + magic-link + rate limiting are exactly where hand-rolled code sprouts bugs. **Cloudflare Access** — elegant for the owner studio, cannot model couple logins; usable as an _extra_ wall in front of `/studio` later.

**Security note on tokens:** generated with `crypto.getRandomValues` (≥16 bytes, base58 ≈ 22 chars); unguessable at any realistic request rate, and RSVP endpoints are Turnstile-gated and rate-limited anyway (§7). Tokens are revocable (row flag) and per-card, so a leaked link burns one card, not an event. **Cost:** $0. **Dev speed/maintainability:** one library, schema-migrated alongside the app; no vendor console.

### 4.5 State management — **framework-native (Svelte 5 runes + URL state). No library.**

The dashboard's global state is a user session and a filter string; the invitation page's state is one RSVP form. Svelte's built-in reactivity plus keeping filters in the URL (shareable, refresh-safe) covers this completely. **Redux/Zustand/TanStack Query solve problems this app does not have** (cross-cutting client caches, offline mutation queues, 100-component data flows). Adopting one would be résumé-driven architecture. _Trigger to revisit:_ a future realtime seating-chart editor or check-in PWA with offline sync — and even then, scoped to that surface. **Cost of decision:** zero bytes, zero concepts.

### 4.6 API style — **framework-native server functions (SvelteKit `load` + form actions) with a thin REST layer only where a URL must be public**

**Why.** There is exactly one API consumer: the app itself. `load` functions give typed server→page data without designing an API; form actions give validated, CSRF-protected writes with progressive enhancement (RSVPs still work if JS fails on an old Android — worth real money in this market). Two or three conventional REST endpoints exist where an out-of-app caller needs a URL: `POST /api/rsvp/{token}` (also serves a future check-in PWA) and `GET /api/events/{id}/export.csv`.

**Alternatives.** **GraphQL** — schema, resolvers, codegen and caching complexity to serve one first-party client; the canonical over-engineering here. **tRPC** — solves client/server type-sharing that SvelteKit already provides in-framework. **gRPC** — binary RPC for service meshes; no services, no mesh. _Trigger to revisit:_ a second first-party client (native app) or third-party integrations → formalize the REST surface with OpenAPI then, not before.

### 4.7 Caching — **CDN edge caching of rendered pages + HTTP cache headers. No cache server.**

**Why.** The read path (guest opens invitation) dominates 100:1 and the content changes rarely (owner edits theme; guest RSVPs don't alter the page for _other_ guests). Strategy: personalized-but-stable invitation pages served with `Cache-Control: public, s-maxage` and purged via Cloudflare's cache API on event edits; static assets immutable-hashed; dashboards `no-store`. Result: the burst never reaches the database — it hits PoPs in Beirut, Paris, Dubai, São Paulo.

**Alternatives.** **Redis/Upstash** — a cache server in front of a database doing single-digit-ms reads at hundreds-per-day volume caches nothing but complexity; also adds the only always-on cost in sight. **Workers KV for page fragments** — available free (100 K reads/day) and reserved as the escape hatch if per-token HTML caching ever needs finer control; not in the MVP because HTTP caching is simpler and observable. **In-memory per-isolate memoization** — micro-optimization; isolates are ephemeral. _Trigger:_ sustained >50 K dynamic requests/day (≈ two orders of magnitude away).

### 4.8 Search engine — **none. SQL `LIKE` + client-side filtering.**

The only search in the product is "find a guest in this event's list" — ≤ 500 rows, already loaded into the dashboard table. A case/diacritic-insensitive filter in the browser plus an indexed `LIKE '%name%'` server-side (for exports) is a complete solution at 0 ms perceived latency. **Elasticsearch/OpenSearch** (a JVM cluster to babysit), **Meilisearch/Typesense** (another container/VM = the only fixed cost in the design), and even **SQLite FTS5** (available inside D1 later, for free, if fuzzy Arabic/Latin cross-script matching is ever wanted) were all evaluated; only FTS5 survives as a future option because it adds zero infrastructure. _Trigger:_ multi-thousand-guest corporate events with cross-event search.

### 4.9 File storage — **Cloudflare R2, audio-only in MVP (no photo uploading — hard constraint #1)**

**Why.** With photo uploading excluded from the MVP, stored media shrinks to **one music track per event** (~3–4 MB, see §3.1) plus any theme imagery the owner places _manually_ (committed repo assets or direct `wrangler r2 object put` — no upload UI exists for images). QR codes are rendered client-side and never stored. R2 remains the right home: S3-API-compatible, **zero egress fees**, free to 10 GB storage / 10 M reads / 1 M writes monthly — three orders of magnitude above ~25 audio files per year — served through the Worker with immutable cache headers. The owner studio exposes exactly one upload control: the event's audio track. No image pipeline, no resizing code, no moderation surface exists in the MVP.

**Alternatives.** **AWS S3** — egress pricing plus a second vendor. **Backblaze B2** — honest pricing, but a second vendor for no feature. **Cloudinary** — its transforms are the point, and nothing needs transforming now. **Bundling audio into the app build** — rejected: redeploying the app to change a song couples per-wedding content to code releases.

**Deferred (with triggers).** Owner photo pipeline + gallery slide → _trigger:_ the owner decides invitations need managed imagery beyond hand-placed theme assets (the v1.0 design — browser-side canvas resize to WebP at upload, $0 — stands ready). Guest photo wall (QR upload, moderated) → _trigger:_ explicit paying demand. Video invitations → _trigger + cost check:_ Cloudflare Stream vs. R2+HLS, only if a couple pays for it.

### 4.10 Message queue / event bus — **none. `ctx.waitUntil` for fire-and-forget; Cron Triggers for scheduled work.**

The async inventory is short: send a notification email after an RSVP (fire-and-forget after the response returns — `waitUntil`), nightly backup dump, and scheduled "reminder to non-responders" batches (Cron Trigger iterating a few hundred rows). Nothing has fan-out, ordering, or retry semantics worth a broker. **RabbitMQ/Kafka** — infrastructure with a feeding schedule, absurd here. **SQS/Cloudflare Queues** — Queues did just land on the free plan (10 K ops/day, 24 h retention), so the _cost_ objection is gone; the _complexity_ objection stands: a queue between two functions in the same Worker is ceremony. _Trigger:_ WhatsApp Business API sending at volume (rate-limited, retry-sensitive) — adopt Queues that week, not before.

### 4.11 Hosting & deployment — **Cloudflare Workers (static assets + SSR), single deployable, IaC via `wrangler.toml`**

**Why.** Consolidation is the feature: compute, DB, object storage, cron, DNS, TLS, CDN, bot mitigation (Turnstile) under one free-tier account with **commercial use explicitly permitted** — the clause that disqualifies Vercel's free tier outright. Unlimited static bandwidth absorbs the burst pattern; 100 K Worker requests/day covers dynamic traffic ~30× over; the entire environment is declared in `wrangler.toml` (bindings for D1/R2/cron), so "infrastructure as code" is one 40-line file in git.

**Alternatives.**

| Option                             | Why not selected                                                                                                                                                                                                                                                                                          |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Vercel**                         | Hobby tier prohibits commercial use; Pro is $20/mo — 100% waste against an equivalent $0.                                                                                                                                                                                                                 |
| **Netlify**                        | Free tier allows commercial use and full Node functions (the fallback if a Node-only dependency ever becomes essential); loses on bandwidth caps (100 GB) vs. unlimited, and no D1/R2 co-location.                                                                                                        |
| **Hetzner/Contabo VPS (~€4–6/mo)** | The strongest challenger and the designated **graduation path**: full control, full Node, Docker. Rejected for launch on ops burden (backups, patching, monitoring, single-machine SPOF) and fixed cost during idle months. SvelteKit's Node adapter makes this migration a config change, not a rewrite. |
| **Fly.io / Railway / Render**      | Paid or sleep-on-idle free tiers; sleep-then-burst is this product's worst failure mode.                                                                                                                                                                                                                  |
| **Shared PHP hosting**             | Only relevant under a Laravel choice already rejected.                                                                                                                                                                                                                                                    |

**Deployment model:** trunk-based; every push builds and deploys a **preview URL** (used to show couples their draft site — a genuinely useful sales artifact); merge to `main` → production. Rollback = redeploy previous version from the dashboard, ~30 s.

### 4.12 CI/CD — **GitHub Actions (checks) + Cloudflare Workers Builds (deploy previews & production)**

Pipeline on every PR: typecheck → lint → Vitest unit suite → build → Playwright smoke on the preview deployment. Merge to `main` promotes. GitHub Actions free minutes (2,000/mo private) exceed need by ~20×; secrets live in Wrangler/GH encrypted stores, never in the repo. **Alternatives:** GitLab CI (fine, but repo gravity is GitHub), Jenkins (self-hosted CI for a solo dev is satire), "no CI, deploy from laptop" (acceptable week 1, but the E2E gate is what lets a part-time maintainer ship on a Tuesday night before someone's Saturday wedding — it stays).

### 4.13 Monitoring & logging — **Sentry (free) + UptimeRobot (free) + Cloudflare analytics/logs + a `/healthz` endpoint**

Failure modes that matter: (1) RSVP submissions erroring silently → **Sentry** client+server SDKs, 5 K events/mo free, release-tagged; (2) site down during a blast → **UptimeRobot** external ping on `/healthz` (checks a D1 read) every 5 min, alerting to email/Telegram; (3) "how many guests opened it?" → Cloudflare's built-in analytics answer the couple's favorite question for free; (4) audit trail → an `audit_log` table (who created/edited/deleted what, when) — 20 lines of code that settles "my aunt swears she RSVP'd" disputes, which _will_ happen. **Alternatives:** Grafana/Prometheus stack (an ops hobby, not a monitoring solution here), Axiom/Better Stack logs (nice, adopt if log volume ever matters), Datadog (priced for teams). **Cost:** $0.

### 4.14 Testing strategy — **risk-weighted: unit-test the invariants, E2E the money paths, types + Zod everywhere else**

For a solo part-time maintainer, tests are the substitute for a QA colleague — concentrated where breakage costs a real wedding:

- **Unit (Vitest):** seat-allocation invariants (`confirmed ≤ max`, re-RSVP overwrites not duplicates), token generation/validation, i18n string completeness (a test that fails if an Arabic key is missing — cheap insurance against shipping a half-translated page), date/timezone rendering.
- **E2E (Playwright), ~7 scenarios:** guest opens token link → cover → start button (audio playback state asserted) → swipes slides → RSVPs yes(2) → dashboard reflects it; guest declines; invalid/revoked token → graceful page; couple magic-link login; owner creates event + bulk-imports 50 invitations → links generated; CSV export matches DB. Run against every preview deploy in CI, in Chromium + one WebKit mobile profile (the iPhone-on-WhatsApp reality).
- **Boundary safety:** strict TypeScript + Zod schemas on every form action/endpoint — the highest-leverage "test" in the codebase, catching malformed input at compile-and-runtime for near-zero effort.
- **Explicitly skipped:** coverage targets, visual regression, load testing (the CDN is the load answer). _Trigger:_ first paying corporate client → add contract tests on the public REST endpoints.

---

## 5. Data Model (D1 / SQLite via Drizzle)

```sql
events(
  id TEXT PK, slug TEXT UNIQUE, type TEXT DEFAULT 'wedding',   -- event-agnostic by design
  title_en/ar/fr TEXT, date_main TEXT, dates_extra JSON,
  theme JSON,                    -- colors, fonts, slide order, music_key (R2), asset keys
  languages JSON,                -- e.g. ["ar","fr","en"], first = default
  status TEXT CHECK IN (draft, live, archived),
  payment_status TEXT,           -- owner-recorded: pending/deposit/paid  (no billing engine)
  created_at, updated_at
)

locations(
  id TEXT PK, event_id FK, kind TEXT CHECK IN
    (house_groom, house_bride, ceremony, reception, other),
  label_en/ar/fr TEXT, maps_url TEXT, lat REAL, lng REAL,
  starts_at TEXT, sort INTEGER
)                                -- 0..n per event: the brief's four fields are a template, not a schema

invitations(
  id TEXT PK, event_id FK,
  token TEXT UNIQUE,             -- 128-bit random, base58; the guest's capability
  guest_label TEXT,              -- "Elie & Maya" as printed on the card
  max_seats INTEGER CHECK (max_seats >= 1),
  phone TEXT NULL, lang TEXT NULL, group_tag TEXT NULL,   -- family / friends / work…
  revoked INTEGER DEFAULT 0, created_at
)

rsvps(
  invitation_id PK FK,
  attending INTEGER,             -- 1 yes / 0 no
  confirmed_seats INTEGER CHECK (confirmed_seats >= 0),
  note TEXT, updated_at
)                                -- one row per card, upsert on re-answer; app enforces confirmed_seats <= max_seats

users / sessions / auth tables   -- Better Auth (owner + couples), role + event scoping
audit_log(id, actor, action, entity, entity_id, at, meta JSON)
```

Integrity rules — one card = one authoritative answer (family answers as a unit, matching the requirement); seat ceiling enforced in the form, the action, and a CHECK; dashboard aggregates are two indexed GROUP BY queries. Year-one totals: ~10 K invitation rows + ~10 K RSVP rows ≈ **~5 MB** — every database limit in §4.3 is theoretical.

## 6. Project Structure — single repo, single app (modular monolith)

```
einvite/
├─ wrangler.toml                 # all infra: D1/R2 bindings, cron, routes
├─ drizzle/                      # SQL migrations (plain, auditable)
├─ src/
│  ├─ lib/
│  │  ├─ server/    db.ts, auth.ts, services/ (rsvp.ts, invitations.ts, export.ts, backup.ts)
│  │  ├─ components/sections/    # Cover, Hero, Countdown, Story, Locations, RsvpForm, Closing
│  │  ├─ components/AudioPlayer.svelte   # single persistent element, gesture-unlocked (§3.1)
│  │  ├─ themes/                 # theme JSON schema + presets ("templates")
│  │  └─ i18n/                   # ar.json (RTL), fr.json, en.json + helpers
│  └─ routes/
│     ├─ e/[slug]/i/[token]/     # public invitation (cached)
│     ├─ dash/[event]/           # couple dashboard (auth: couple)
│     ├─ studio/                 # owner console (auth: owner+TOTP)
│     └─ api/                    # rsvp/[token], export.csv, healthz
├─ tests/  unit/  e2e/
└─ .github/workflows/ci.yml
```

**Not** a monorepo, **not** packages, **no** shared-lib extraction: at one app and one developer, Turborepo/Nx would be pure ceremony. The `sections/` + `themes/` pair is the reusable core — a new wedding (or baptism) is a row plus a theme JSON, never a new codebase.

---

## 7. Security & Privacy

**7.1 Threat model (proportionate).** Assets: guest PII (names, phones, attendance, sometimes children's names), event details, the owner's reputation. Realistic adversaries: link-guessing curiosity, RSVP spam/pranks (non-trivial socially — a prank "200 guests declined" is real damage), a leaked forwarded link, and generic bot scanning. Not in scope: nation-state anything.

**7.2 Controls.**

- **Tenant isolation in one DB:** every query is scoped by `event_id` derived from the session or token server-side — never from client input; the E2E suite includes a cross-tenant access attempt that must 403.
- **Tokens:** ≥128-bit CSPRNG, base58, unguessable at any feasible rate; per-card revocation; token pages send `noindex` and the app never emits token URLs in sitemaps/logs. Accepted residual risk: guests forward links (that's the product); WhatsApp preview crawlers will fetch the page — previews show the design, never RSVP state.
- **Abuse resistance:** Cloudflare **Turnstile** (free, invisible) on RSVP submission; per-IP and per-token rate limits on write endpoints; Zod validation everywhere; parameterized queries via Drizzle (SQLi), Svelte auto-escaping (XSS), form actions' origin checks (CSRF).
- **Session/auth hygiene:** HttpOnly/Secure/SameSite cookies, short-lived magic links (15 min, single-use), TOTP on the owner account, secrets only in Wrangler/GH secret stores.
- **Headers:** CSP (self + Turnstile, `media-src` for R2 audio; maps open as plain links, so no embed origin is needed), HSTS, Referrer-Policy `same-origin` — one hooks file.

**7.3 Privacy & data protection.** Guest lists are personal data. Lebanon's Law 81/2018 (Electronic Transactions & Personal Data) applies; diaspora guests bring GDPR-adjacent expectations. Posture: **data minimization** (name label + seats; phone optional; no birthdays, no addresses), a **retention policy** — auto-archive and purge guest PII N months post-event (default 6, owner-configurable) — which is both compliance hygiene and a selling point ("your guest list isn't kept forever"), a one-paragraph privacy note on invitation pages, and export/delete honored manually at this scale (a `DELETE` the owner can run from the studio).

**7.4 Backup & disaster recovery.** Three layers: D1 **Time Travel** (30-day point-in-time restore, built-in); a **nightly Cron dump** of all tables to R2 as dated SQL/CSV (survives account-level mistakes, satisfies "can I have my guest list in Excel forever"); `wrangler d1 export` before every migration in CI. Media in R2 is the primary copy — quarterly `rclone` pull to local storage covers the paranoid case. RTO: minutes (redeploy + restore); RPO: ≤24 h, ≤1 min within Time Travel's window.

## 8. Lebanon-Market Notes (architecture-relevant only)

- **Trilingual, RTL-first:** every content field is `{ar, fr, en}`; per-_invitation_ language override (Teta's card renders Arabic, the Paris cousins' French) — a cheap column that outclasses global-language competitors; `dir="rtl"` handled at the layout root; test suite enforces translation completeness (§4.14).
- **WhatsApp is the delivery network:** share = `wa.me/{phone}?text={greeting + link}` deep links generated in the studio (zero cost, zero API approval); correct OpenGraph tags make the link preview itself look like a designed card — that preview _is_ the first impression. WhatsApp **Business API** (paid, Meta-approved, per-message fees) is deliberately post-MVP; adopt with Queues (§4.10) if volume sending ever pays for itself.
- **Diaspora latency:** solved structurally by edge caching (§4.7) — Paris, Dubai, Montreal, São Paulo guests hit local PoPs.
- **Payments (couples → owner):** offline by necessity (no Stripe in Lebanon): OMT/Whish/bank/cash, recorded in `events.payment_status`. No card data ever touches the system — a compliance surface of zero.
- **Owner-side resilience:** serverless means the owner's electricity/connectivity outages (a real Lebanese variable) cannot take the product down; the laptop is only needed to _change_ things.

## 9. Cost Model

| Stage                                         | Monthly                    | Notes                                                                                   |
| --------------------------------------------- | -------------------------- | --------------------------------------------------------------------------------------- |
| **Launch → ~25 weddings/yr**                  | **$0** + domain ~$10–12/yr | Everything in §4 free tiers; headroom 30–200× on every quota                            |
| First pinch (~5–10× traffic or CPU-heavy SSR) | $5                         | Workers Paid: lifts request/CPU/D1 caps in one switch                                   |
| Media growth (>10 GB)                         | ~$0.015/extra GB·mo        | R2 storage; ~25 audio tracks/yr ≈ 0.1 GB — decades of headroom; egress stays $0         |
| Volume WhatsApp sending                       | Meta per-message fees      | Business decision, not infra                                                            |
| **Graduation path (optional, 100×)**          | ~€5–8                      | Hetzner VPS + Docker + Postgres/SQLite; SvelteKit Node adapter = config-level migration |

Hard constraint #3 verified line-by-line: no MVP component carries a bill — maps are plain links (no API key), messaging is `wa.me` deep links (no API), media is one audio file per event, Turnstile/Sentry/UptimeRobot are free tiers. Unit economics: infrastructure cost per wedding at launch ≈ **$0.04** (domain amortized). Against local market pricing of ~$30–150/wedding, gross margin is effectively the sale price — the business risk is entirely in sales, not systems. Vendor lock-in is the honest cost of the $0 bill; mitigations are structural: standard SQLite dumps nightly, S3-compatible storage, adapter-portable framework, plain SQL migrations.

## 10. Implementation Roadmap (part-time, ~8 weeks to first live wedding)

**Phase 0 — Foundation (wk 1).** Repo, `wrangler.toml` (D1/R2/cron bindings), Drizzle schema + migrations, Better Auth wiring, CI skeleton, domain + DNS. _Exit:_ deployed "hello" at the real domain; owner can log in with TOTP.

**Phase 1 — Invitation renderer (wk 2–3).** Cover page + audio unlock + scroll-snap slide shell (§3.1), section component library, theme JSON schema + 2 presets, i18n (ar/fr/en, RTL), token route with personalization, RSVP form action with seat ceiling + Turnstile, edge-cache headers + purge-on-edit. _Exit:_ a seeded demo wedding opens from the cover with music, renders in 3 languages, swipes through all slides; RSVP persists; Playwright happy path green, including an iOS-profile audio-unlock check.

**Phase 2 — Studio & dashboard (wk 4–5).** Owner: event CRUD, theme editor w/ live preview, audio-track upload (the system's only upload control), CSV/paste bulk import → token + QR + wa.me link generation, payment-status field. Couple: magic-link login, RSVP table (filters, seat totals, pending), CSV export. Audit log. _Exit:_ full lifecycle — create → import 50 guests → share → track — without touching code.

**Phase 3 — Hardening & pilot (wk 6–7).** Sentry + UptimeRobot + `/healthz`, nightly backup cron + restore drill (actually restore once), rate limits, security headers, retention job, remaining E2E scenarios, Lighthouse pass on a mid-range Android profile. _Exit:_ **pilot wedding** (friends & family) at real scale.

**Phase 4 — Go-live (wk 8).** Pilot fixes; second theme preset; one-page runbook (restore, purge cache, revoke token, resend magic link); soft launch to planners/photographers.

**Post-MVP backlog (pull by demand, not roadmap):** door check-in PWA (QR scan → seats arrived; the REST endpoint already exists) → owner photo pipeline + gallery slide, then guest photo wall (QR upload → R2, moderated) — **both locked behind hard constraint #1 until the owner lifts it** → automated WhatsApp reminders (Queues + Business API) → non-wedding event presets (engagement, baptism, birthday — schema-ready today) → self-serve tier _only if_ managed demand proves it.

## 11. Top Risks & Mitigations

| Risk                              | Exposure           | Mitigation                                                                                                                                               |
| --------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cloudflare free-tier terms shift  | Medium/low         | Portable core (SQLite dumps, S3-compat R2, adapter swap); Netlify+Turso and VPS paths pre-identified; $5 paid tier is the trivial first answer           |
| Solo bus-factor                   | High/medium        | Boring stack, typed code, plain-SQL migrations, runbook, IaC in one file — the codebase stays legible to a future contractor (or the owner in 18 months) |
| RSVP spam/prank on a live wedding | Medium             | Turnstile + rate limits + per-card revocation + audit log; dashboard shows anomalies immediately                                                         |
| Svelte-ecosystem gaps vs. React   | Low                | Needs are commodity (forms/tables/embeds); differentiating UI is hand-built by design                                                                    |
| Scope creep toward "platform"     | **Highest of all** | This document: every deferred component has a written trigger; nothing ships before its trigger fires                                                    |

---

_End of document. Decision triggers in §§4.5–4.10 are the contract with future-you: revisit when a trigger fires — not when a technology gets exciting._

---

**Changelog**

- **v1.1** — Owner constraints incorporated: photo uploading removed from MVP scope everywhere (§2.1, §4.9, §6, §10); cover page + music-on-open + swipeable slides fully specified (§3.1, §4.1, §4.14, §10); near-zero cost elevated to a hard constraint and verified line-by-line (§2.2, §9); R2 overage pricing corrected to $0.015/GB·mo; maps fixed as plain links (no API key ever needed).
- **v1.0** — Initial architecture and roadmap.
