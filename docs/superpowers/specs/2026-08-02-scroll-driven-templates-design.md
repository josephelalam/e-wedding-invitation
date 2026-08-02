# Scroll-driven template modules: `depth` and `overture`

Design spec — 2026-08-02

Two new invitation layouts join `slides`, `edges`, and `cinematic`. Both are
built on one shared scroll-progress engine. They exist to answer a product
question: **how much of the "scroll-driven 3D website" look is worth its cost
on the phones our guests actually use?** So they are deliberately a controlled
pair — the only difference between them is a WebGL overture.

| id         | Name                    | Cost over baseline              |
| ---------- | ----------------------- | ------------------------------- |
| `depth`    | Depth — Parallax Story  | ~1.5 KB shared engine, no deps  |
| `overture` | Overture — The Envelope | `depth` + a lazy three.js chunk |

## 1. Background

The genre reference is the Three.js scroll-animation family: Bruno Simon's
[Three.js Journey scroll lesson](https://threejs-journey.com/lessons/scroll-based-animation),
[Codrops' scroll-based animation tutorial](https://tympanus.net/codrops/2022/01/05/crafting-scroll-based-animations-in-three-js/),
and its
[folding cardboard box](https://tympanus.net/codrops/2022/12/13/how-to-code-an-on-scroll-folding-3d-cardboard-box-animation-with-three-js-and-gsap/)
piece, whose fold rig is exactly an envelope-opening rig.

The technique underneath all of them is not Three.js. It is: _map scroll offset
to a normalized 0→1 progress value, then drive something with it._ Three.js is
one of the things you can drive; CSS transforms are another and cost nothing.
`depth` drives CSS. `overture` drives both.

`Cover.svelte` already describes itself as "the envelope front (spec §3.1.1)".
`overture` is the natural next beat: open it.

## 2. Architecture

```
src/lib/actions/
  scroll-progress.ts     NEW  one rAF engine; use:progress writes --p (0→1)

src/lib/templates/shared/
  ScrollBody.svelte      NEW  parallax shell; renders theme.slideOrder through
                              the existing section components
  Envelope.svelte        NEW  CSS 3D envelope + optional WebGL upgrade
  envelope-webgl.ts      NEW  procedural three.js scene; lazy chunk

src/lib/templates/depth/Template.svelte      NEW  Cover + ScrollBody
src/lib/templates/overture/Template.svelte   NEW  Envelope + ScrollBody

src/lib/themes/schema.ts       EDIT  TEMPLATE_IDS += 'depth', 'overture'
src/lib/templates/registry.ts  EDIT  register both (name + tagline)
docs/templates.md              EDIT  shipped-modules table + engine note
tests/seed/seed-e2e.ts         EDIT  one fixture event per template
tests/e2e/templates.spec.ts    EDIT  specs per docs/templates.md rule 5
```

Both templates reuse the existing section components (`Countdown`, `Locations`,
`Schedule`, `GiftAccount`, `RsvpBlock`, `Closing`) unchanged. All
differentiation lives in the scroll shell. Any choreography that wins here can
be back-ported into `slides`/`edges`/`cinematic` afterwards.

`Envelope.svelte` is the entire delta between the two templates. Once it
reaches progress 1 it disposes its renderer and unmounts, after which
`overture` and `depth` are running identical code.

## 3. The scroll-progress engine

### 3.1 Why JS and not `animation-timeline`

Native CSS scroll-driven animations were considered and rejected on two counts.
[Firefox 152 (June 2026) still gates them behind
`layout.css.scroll-driven-animations.enabled` in stable](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Scroll-driven_animations),
so the feature is ~84% supported and not Baseline. More decisively, a CSS
timeline cannot feed Three.js, and `overture` needs the progress as a JS
number. A hybrid (native where supported, JS elsewhere) was also rejected: two
code paths that must stay pixel-identical, for a difference no guest can see.

One JS engine serves every element in both templates and the WebGL scrub reads
the identical value. Styling stays declarative in CSS — the engine only
supplies the number.

### 3.2 Contract

```ts
type ProgressMode = 'view' | 'page';
export function progress(node: HTMLElement, mode?: ProgressMode): ActionReturn;
export function computeProgress(scrollY: number, vh: number, top: number, height: number): number; // pure, clamped 0..1 — unit-tested directly
```

- `view` (default) — `--p` is 0 when the element's top edge meets the viewport
  bottom, 1 when its bottom edge meets the viewport top.
- `page` — `--p` tracks whole-document scroll. Used once, by the photo plane.

### 3.3 Performance rules

These are requirements, not aspirations:

- **Zero forced layout per frame.** Each element's `offsetTop`/`offsetHeight`
  is cached at registration and refreshed only on `ResizeObserver`. Per frame
  the loop reads `window.scrollY` once, then does arithmetic and
  `style.setProperty` and nothing else. No `getBoundingClientRect` in the loop.
- **The loop parks** when no registered element intersects the viewport
  (gated by one shared `IntersectionObserver`) and whenever `document.hidden`.
  This matters: guests leave invitations open while music plays.
- **One loop process-wide**, shared across all registered elements, not one
  rAF per element.

### 3.4 Progressive enhancement

Every driven property reads `--p` **with its settled value as the CSS
fallback**:

```css
opacity: var(--p, 1);
transform: translateY(calc((1 - var(--p, 1)) * 40px));
```

Unset `--p` resolves to the fallback, which is the at-rest appearance. So both
"no JS" and "reduced motion" reduce to the same implementation: _do not
register the element_. There are no `@media` overrides duplicating the
choreography and nothing to keep in sync. The engine returns early — exactly as
`src/lib/actions/inview.ts` already does — when
`prefers-reduced-motion: reduce` matches.

This satisfies the standing rule in `docs/templates.md`: content must render
without JS.

## 4. Choreography

### 4.1 Photo plane (`ScrollBody`, mode `page`)

Wraps the existing `Slideshow.svelte` unchanged. `Slideshow` is
`position: absolute; inset: 0`, so a `position: fixed` parent carrying the
parallax translate composes cleanly with its internal `breathe` keyframe —
the two scale/translate sources sit on different elements.

- Drifts `-14vh` across the full page against content at 1.0x.
- Scrim deepens `0.42 → 0.62` so text stays readable as the photo set
  brightens.
- **Purely vertical.** No X component, so `depth` needs no RTL mirroring at
  all. Only the envelope does.

### 4.2 Content sections (mode `view`)

| Range         | Behaviour                                             |
| ------------- | ----------------------------------------------------- |
| `0 → 0.25`    | enter: opacity 0→1, `translateY` 40px→0, blur 4px→0   |
| `0.25 → 0.85` | settled                                               |
| `0.85 → 1`    | recede: opacity 1→0, `translateY` 0→-24px, blur 0→3px |

The recede is the actual difference from the existing `.reveal` in
`InvitationPage.svelte`, which only ever enters.

**`rsvp` and `gifts` are enter-only — they never recede.** An RSVP form must
not fade while a guest is typing in it, and the registry account number must
stay legible while they are copying it.

### 4.3 Signature moments

1. **Monogram ring draw.** An SVG `<circle>` around the monogram, with
   `stroke-dashoffset: calc((1 - var(--p, 1)) * var(--circ))`. A circle rather
   than stroked text, so it works for any monogram glyph including Arabic and
   carries no font-loading dependency.
2. **Engraved date.** The hairlines flanking `ctx.dateParts` grow from centre
   via `scaleX(var(--p, 1))`. Weekday / day-month / year lift on staggered
   slices of the same variable — `clamp(0, (var(--p) - 0.1) * 3, 1)` and
   friends — so the stagger is pure CSS with no per-element JS.
3. **Photo interstitials.** Full-bleed bands drawn from `ctx.imageUrls`
   between sections, scaling `1.15 → 1.0` across their transit so each image
   settles as the guest passes it. The most recognizable move from the
   reference genre.
4. **Countdown roll.** The existing `Countdown` wrapped in a plane whose digits
   translate into place on `--p`.

### 4.4 The envelope (`overture`)

A 200vh sticky stage. Before the tap the scroller is locked, matching the
`.locked` pattern already in `slides/Template.svelte`.

| Range         | Behaviour                                                      |
| ------------- | -------------------------------------------------------------- |
| tap           | unseals; **this is the `onopen` audio-unlock gesture**         |
| `0 → 0.35`    | flap `rotateX(0 → -170deg)` about its top edge                 |
| `0.35 → 0.75` | card rises `translateY(0 → -55%)`, tilt eases flat             |
| `0.75 → 1`    | card scales to fill, envelope fades, WebGL disposes at ≥ 0.995 |

The tap is mandatory: iOS Safari will not start audio from a scroll, so the
audio unlock cannot be scroll-driven. `overture` still exposes
`id="slide-0"` as the post-open scroll target and a `data-section="rsvp"`
element, per the module contract.

RTL mirrors the card's slight X drift on exit.

## 5. The WebGL upgrade

### 5.1 Procedural, never loaded

The scene is built in code: a back panel, two side flaps, a bottom flap, a top
flap, and a card — six `PlaneGeometry`s driven on `rotation.x`/`rotation.z`,
one `DirectionalLight` plus ambient, `MeshStandardMaterial`.

This is a CSP requirement, not a preference. `vite.config.ts` sets
`default-src 'self'` with no `worker-src` override, so a blob-URL worker is
blocked and GLTF + DRACO is unavailable. Procedural geometry needs no loader,
no asset fetch, and no `unsafe-eval`. The card's front face samples
`ctx.imageUrls[0]`, which is same-origin R2 through the existing `/api/media`
route and therefore satisfies `img-src 'self'`.

### 5.2 Gating

All of: `!prefers-reduced-motion`; a WebGL2 context that actually acquires;
`navigator.connection?.saveData !== true`; `navigator.deviceMemory >= 4` where
reported.

### 5.3 Handoff

`import('./envelope-webgl')` fires **on the tap, not on page load**, so the
download overlaps the flap animation CSS is already running. It swaps in only
if it resolves before `p > 0.15`; past that the CSS version finishes the job,
because a renderer swap mid-animation is worse than no upgrade at all.

`docs/templates.md` records that guest HTML is edge-cached 120 s, so after a
deploy a guest can hold HTML referencing the previous build's hashed chunks.
The dynamic import therefore has a `.catch()` that leaves the CSS envelope in
place. A failed upgrade is invisible, never a broken invitation.

### 5.4 Disposal

`dispose()` disposes every geometry, material, and texture, calls
`renderer.forceContextLoss()`, cancels the rAF, and removes the canvas from
the DOM. After disposal the GPU is idle for the rest of the visit.

## 6. Fallback matrix

No-JS and `prefers-reduced-motion` both leave `--p` unset, so they are the same
rest state by construction — one state to reason about and one to test. An
earlier draft asked for a sealed envelope on no-JS and an open one on reduced
motion; that would have required the engine to write `--p: 1` explicitly on the
reduced-motion path, and it bought nothing a guest cares about. Amended
2026-08-02 during pre-flight review.

| Condition                      | `depth`                         | `overture`                                |
| ------------------------------ | ------------------------------- | ----------------------------------------- |
| No JS                          | all content, settled, no motion | envelope open, card and story readable    |
| `prefers-reduced-motion`       | not registered; `--p` unset     | envelope open, no scrub — same rest state |
| JS, no WebGL                   | —                               | CSS 3D envelope                           |
| WebGL available                | —                               | three.js, same scrub                      |
| Chunk 404 (120 s cache window) | —                               | `.catch()` → CSS envelope, invisibly      |

## 7. Budget

- `three` is the only new runtime dependency, and it must reach guests
  **only** through `overture`'s async chunk — measured and enforced, see
  below. It does **not** follow that a guest served `depth`, or any of the
  three pre-existing templates, downloads zero additional bytes: `registry.ts`
  statically imports all five `Template.svelte` files (so both the guest
  dispatcher and the studio's instant-preview template switcher can render
  whichever one is picked), and since none of the five is ever imported from
  anywhere else, the bundler inlines all of them — plus `ScrollBody`,
  `Envelope`, and `scroll-progress.ts` — into the one chunk that import graph
  produces. Measured from a real production build: that chunk (Vite names it
  `InvitationPage`) is ~54 KB raw / ~16 KB gzipped, and every guest on every
  template downloads all of it, not just the code for their own event's
  layout. What the ~1.5 KB figure actually describes is `scroll-progress.ts`
  in isolation, not what a guest's browser fetches. The guarantee that does
  hold, and is the one this budget section exists to protect: three.js itself
  (the ~127 KB payload measured below) never joins that eager chunk — it's
  reachable only through `overture`'s own `dynamicImports` edge, which is
  exactly what `tests/unit/bundle.test.ts` walks the build manifest to prove.
- `overture`'s three.js chunk has a **hard ceiling of 150 KB gzipped, measured
  from the real production build**. If it exceeds that, the fallback is
  hand-rolled WebGL or OGL (~10 KB); a six-plane scene is simple enough for
  either.
- The chunk must be **async and absent from the initial guest bundle** —
  asserted by a test over the build manifest.
- Engine: zero `getBoundingClientRect` per frame; loop parked when off-screen
  or `document.hidden`.

## 8. Testing

**Unit**

- `computeProgress` — table-driven over the clamped 0..1 range, including
  above-viewport, below-viewport, taller-than-viewport, and zero-height cases.
- Schema round-trip: `parseTheme({ template: 'depth' })` and `'overture'`.
- Registry completeness: every id in `TEMPLATE_IDS` has a `TEMPLATES` entry.
  This guards precisely the mistake this change makes easy.
- Build manifest: `three` resolves into an async chunk only. It must appear in
  neither the initial guest entry nor any chunk reachable from `depth`, so a
  guest on any template other than `overture` never downloads it.

**E2E** (`tests/e2e/templates.spec.ts`, per `docs/templates.md` rule 5)

- Two fixture events seeded in `tests/seed/seed-e2e.ts`.
- `depth`: photo plane present, sections render in `slideOrder`, one RSVP
  round-trip.
- `overture`: sealed envelope visible, tap unseals and fires the audio unlock,
  scroll advances the card, card content reachable, one RSVP round-trip.
- `reducedMotion: 'reduce'` context: all content fully visible at rest in both
  templates.
- `javaScriptEnabled: false` context: all section text renders in both
  templates.

## 9. Integration

Both templates appear in Studio → Theme → Layout automatically through the
registry, and `/e/<slug>/preview?template=depth` works with no route change.
No studio, route, or database change is required.

## 10. Explicitly out of scope

- Bespoke per-section layouts. Sections are reused as-is; a second pass can
  give bespoke treatment to whichever sections feel flat on a real phone.
- A persistent 3D world or a second WebGL moment (3D photo gallery). The
  overture disposes and does not come back.
- Back-porting the choreography into `slides`/`edges`/`cinematic`. Desirable,
  but a follow-up once the technique has been judged on a device.
