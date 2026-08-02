# Invitation template modules

Every event picks a **layout template** in Studio → event → Theme. All
templates share the same platform contract — personalization from the token,
gesture-unlocked music, trilingual i18n, the progressive RSVP pipeline, edge
caching — so a new module is purely presentation work.

## Shipped modules

| id          | Name                    | Signature                                                                                        |
| ----------- | ----------------------- | ------------------------------------------------------------------------------------------------ |
| `slides`    | Signature Deck          | Ken Burns photo wall + scrim behind scroll-snap slides, monochrome ivory, dot rail               |
| `edges`     | Torn-Paper Story        | formal long scroll: verse → families → photos torn like paper between cards, petals              |
| `cinematic` | Horizon                 | horizontal scroll-snap deck: cover gate → formal → ledger → houses → venues → polaroid           |
| `depth`     | Depth — Parallax Story  | continuous scroll, fixed photo plane at 0.3x, sections settle in and recede, photo bands between |
| `overture`  | Overture — The Envelope | `depth` preceded by a scroll-scrubbed envelope open; CSS 3D by default, three.js when available  |

Horizon extras: the getting-ready scene (both `house_*` locations) always
renders before the ceremony scene regardless of stored sort; a moving swipe
caption sits at the bottom of every scene (hidden on the finale); extra dates
(`datesExtra`) are deliberately not shown in this layout.

## Background video & gift account (2026-07-27)

- `theme.videoKey` (R2 key under `theme/…`, deck layouts only): muted looping
  background video behind the scenes — photos stay the poster and the
  reduced-motion fallback. Guidance for owners lives in Studio → Theme → Layout.
- `theme.giftsAccountLabel` + `theme.giftsAccount`: the cash-registry line
  (Whish/OMT/IBAN) rendered by every template's gifts section as an engraved
  label + number + one-tap copy button (`GiftAccount.svelte`).
- The studio Theme tab is a tabbed editor (Layout/Look/Texts/Gifts & RSVP/
  Photos) with a sticky save bar; switching layout previews instantly via
  `/e/<slug>/preview?template=<id>` (owner-only override, never persisted).

## Look & feel (2026-07-27 uplift)

Design spec: `docs/superpowers/specs/2026-07-27-template-visual-uplift-design.md`.
Self-hosted OFL fonts (`static/fonts` + `src/lib/styles/fonts.css`): Cormorant
Garamond (display), Great Vibes (script names), Cinzel (engraved caps/numerals),
Amiri (Arabic naskh), Jost (body). Templates get them via `--ei-font-script` /
`--ei-font-caps` from the dispatcher; theme fonts stay `--ei-font-display/body`.

## Photos & video (upload policy, owner-revised 2026-07-28)

Every template is photo-dressed by default: when `theme.images` is empty it
falls back to the bundled anonymous stock set in `src/lib/templates/stock.ts`
(`static/photos/*.jpg`, Pexels license).

The owner uploads the couple's media in **Studio → event → Theme → Photos &
Video**: photos (JPG/PNG/WebP ≤ 8 MB, max 12, with reorder + remove) and the
deck layouts' background video (MP4/WebM ≤ 30 MB). Uploads land in R2 under
`theme/<slug>/…` via owner-guarded form actions and update `theme.images` /
`theme.videoKey` instantly. This capability exists **only** in the studio —
guests and couples never get a file input (`tests/unit/no-photo-upload.test.ts`
enforces it). `wrangler r2 object put` still works for bulk/manual placement.

## The scroll-progress engine (2026-08-02)

Design spec: `docs/superpowers/specs/2026-08-02-scroll-driven-templates-design.md`.

`src/lib/actions/scroll-progress.ts` exposes `use:progress`, which writes a
normalized `--p` (0→1) onto its element from one shared rAF loop. Three modes:
`view` (default — 0 as the top edge meets the viewport bottom, 1 as the bottom
edge meets the viewport top), `page` (whole-document scroll), and `sticky`.

`sticky` exists because `view` semantics are wrong for a stage pinned at the
top of the document with `position: sticky`. A 200svh stage with a 100svh
sticky child reads `--p ≈ 0.333` at rest under `view` — `view` measures an
element's _transit through_ the viewport, but a pinned element never
transits, it holds still while the guest scrolls its own height away
underneath, so `view` reports progress for a transit that never happens.
`sticky` instead computes `(scrollY - top) / (stickyHeight - …)` across the
stage's own pin range, and it measures the pinned child's real rendered
height rather than assuming `window.innerHeight` — the two differ on mobile,
where the toolbar showing and hiding changes `innerHeight` but not an
`svh`-sized child. Feeding that mismatch into the formula makes the unpin
point arrive before `scrollY` actually gets there, so `--p` hits 1 early and
holds. `Envelope.svelte`'s 200svh/100svh stage is the one caller today; any
future sticky-pinned stage needs this mode, not `view`.

**Author every driven property as `var(--p, X)` where X is the settled value.**
Unset `--p` then resolves to the at-rest appearance, so no-JS and
`prefers-reduced-motion` are both handled by simply not registering the
element — there is no second code path and no `@media` block to keep in sync.

The loop caches element offsets at registration and refreshes them on
`ResizeObserver`, so it never calls `getBoundingClientRect` per frame. It parks
when nothing registered is on screen and whenever `document.hidden`.

The section components carry their own `use:inview` entrance. `ScrollBody`
neutralizes that inherited `.reveal` inside its subtree so the plane owns the
choreography; the section components themselves are untouched.

three.js reaches guests **only** through `overture`'s async chunk
(`envelope-webgl.ts`), pinned by `tests/unit/bundle.test.ts` to under 150 KB
gzipped (currently ~127 KB). Never import it eagerly. Its geometry is
procedural because the CSP (`default-src 'self'`, no `worker-src`) blocks
DRACO's blob worker.

**Known issue, recorded rather than fixed:** three.js's `TextureLoader` errors
on SVG images (`texSubImage2D: bad image data`, then a follow-on
`glTexImage2DRobustANGLE: Texture is immutable` from the driver). At the JS
layer this fails soft — `mountEnvelope` resolves the texture promise as
`undefined` rather than throwing — but verified in a real browser, the
on-screen result is worse than a missing texture: the WebGL canvas renders
solid black/grey blocks over the envelope, not the envelope minus its photo,
and it stays that way until the guest scrolls. Real owner uploads are
JPG/PNG/WebP, but the e2e fixtures and the production demo events use
`theme/demo/*.svg`, so any WebGL2-capable guest opening an `overture` demo
event hits this today.

## The open/lock convention (2026-08-02)

Every template locks its cover/envelope shut from the very first SSR byte —
`class:locked={!opened}`, with `opened` false on the server too — not from a
post-hydration flag. A hydration gate leaves a window between first paint and
the JS bundle executing where the page is scrollable; a guest on a slow phone
can scroll into the body during that window and then get yanked back when the
lock snaps on. SSR-immediate `class:locked` closes the window entirely.

That leaves exactly one guest who can never fire the open gesture to unlock
the page: one with no JS at all. Every template frees them with a
`<noscript><style>` block using `!important` (Svelte scopes `.locked` behind
a hash class three selectors deep, so a plain override loses the specificity
fight) — **but the override is not copy-paste between templates**, because
each one's base CSS is different:

- `slides` and `cinematic` reset only one overflow axis (`overflow-y` /
  `overflow-x` respectively). Their `.locked` rule never touches height, so
  resetting height too would be pointless at best — and if you add it
  anyway, you'll collapse their `100dvh` scroll-snap container instead of
  freeing it.
- `edges`, `depth`, and `overture` reset both `height` and `overflow`. Unlike
  the two above, their base rule sets neither — `.locked` itself adds both —
  so the override has to put both back (`height: auto`, `overflow: visible`)
  or the guest stays capped at one viewport tall.
- `cinematic` additionally neutralizes its cover overlay. Its cover is
  `position: absolute; inset: 0` with an opaque background — not in normal
  flow — so restoring the track's overflow alone frees nothing: the opaque
  cover still sits on top of the whole deck forever, since a no-JS guest can
  never fire `onopen` to add the `.cover.gone` class that would normally hide
  it. The override applies `.cover.gone`'s own declarations
  (`opacity`/`visibility`/`pointer-events`) directly.

Work out the right override for a new template instead of copying one:
copying `edges`'s reset onto a scroll-snap deck collapses it, and copying
`slides`'s onto a plain scrolling page leaves it locked at one viewport tall.

## Adding a new module

1. `src/lib/templates/<id>/Template.svelte` — implement `TemplateProps`
   (`src/lib/templates/types.ts`): you receive `data` (event, guest,
   locations, theme), `ctx` (resolved localized texts, image URLs, formatted
   date, monogram, `rsvpIsClosed`), `opened`/`onopen` (the audio-unlock
   gesture — call it from your start button), and RSVP state.
2. Reuse the shared pieces where they fit: `templates/shared/RsvpBlock.svelte`
   (deadline-aware RSVP), `Slideshow.svelte`, `GiftAccount.svelte`, and the
   section components (`Countdown`, `Locations`, `Schedule`). Wrap content in
   `use:inview` for the shared entrance reveal. Ambient particles come from
   the dispatcher (`theme.effect`: petals/hearts/sparkles/leaves/snow via
   `Effects.svelte`) — templates don't render them.
3. Add the id to `TEMPLATE_IDS` (`src/lib/themes/schema.ts`) and register it
   in `src/lib/templates/registry.ts` (name + tagline shown in the studio
   picker).
4. Add a curated entry to `STOCK_SETS` in `src/lib/templates/stock.ts`.
   `STOCK_SETS` is typed `Record<TemplateId, string[]>`, so a `TEMPLATE_IDS`
   entry with no matching stock set fails both `npm run check` (a TypeScript
   error, not a runtime surprise) and `tests/unit/stock.test.ts` outright —
   there's no way to add a template without doing this. At least 3 images,
   each an existing `/photos/<name>.jpg` path under `static/photos`.
5. Rules every module must keep: theme colors/fonts come from the `--ei-*`
   CSS variables; `letter-spacing: 0` for RTL (Arabic never tracks — every
   tracked-caps rule needs the `[dir='rtl']` reset, including `text-indent`);
   no external origins (CSP is self + Turnstile only); content must render
   without JS (reveal classes are JS-added; see "The open/lock convention"
   above for the cover/envelope specifically); music is an enhancement, never
   a gate; include an element with `data-section="rsvp"`, and give exactly
   one element `id="slide-0"` as the dispatcher's post-open scroll target —
   never zero, never two. If you build on `ScrollBody`, its default puts the
   anchor on its own first section; pass `ownsSlideAnchor={false}` and place
   the id yourself on whatever sits between the open gesture and `ScrollBody`
   instead (see `overture`'s envelope stage) — otherwise the dispatcher's
   post-open smooth-scroll sails straight through that content to
   `ScrollBody`'s first section instead of stopping there. The `gifts`
   section renders only when the owner filled the gifts note text.
6. Seed a fixture event in `tests/seed/seed-e2e.ts` and add a spec to
   `tests/e2e/templates.spec.ts` asserting the module's signature elements +
   one RSVP round-trip. Two traps whoever writes the no-JS/reduced-motion
   coverage will hit:
   - `toBeVisible()` does **not** catch content clipped by an ancestor's
     `overflow: hidden` — same blind spot as `toBeAttached()` — so a bare
     visibility assertion on `[data-section="rsvp"]` passes even if the lock
     regressed and the section is still trapped off-screen. Use the
     `assertReachableByNativeScroll` helper in `tests/e2e/templates.spec.ts`,
     which drives a real wheel-scroll gesture and asserts the element's
     bounding box actually enters the viewport.
   - `test.use({ reducedMotion: 'reduce' })` is silently a no-op in this
     Playwright/Chromium setup — verified directly, `matchMedia` still
     reports `prefers-reduced-motion: false` with the context option set,
     even on `about:blank`. Call `page.emulateMedia({ reducedMotion: 'reduce' })`
     at runtime instead, or you'll spend an afternoon debugging a test that
     never drove the scenario it claims to.

## Operational notes

- Guest HTML is edge-cached **120 s** — after a deploy, a guest can hold HTML
  that references the previous build's hashed chunks for up to that window;
  keep it short, don't raise it.
- Local dev: wrangler's Cache API persists in `.wrangler/state/v3/cache` and
  survives restarts; `npm run seed:e2e` clears it. Never delete that folder
  while `wrangler dev` is running (the cache worker wedges — restart it).
