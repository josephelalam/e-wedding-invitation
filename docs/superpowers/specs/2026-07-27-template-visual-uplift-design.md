# Template visual uplift — market-leading e-invitation layouts

**Date:** 2026-07-27 · **Status:** approved for implementation (owner directive: "best layout in the market", autonomous session)

## Goal

Uplift the three invitation templates (and the public landing page) to match or beat
the three market references the owner supplied, using real wedding photography as
backgrounds so every event looks like a finished, bespoke invitation from day one.

## Market research (references dissected 2026-07-27)

| | pulsewavetechs `roy-lara` | wendlb `majid-christelle` | cclab (Arabic formal) |
|---|---|---|---|
| Format | full-screen swipe deck | 430px story-app canvas, horizontal swipe | long formal scroll |
| Photography | crossfading engagement photos under 60% black scrim | Ken Burns slideshow, 15% scrim, glass UI | single couple photo, cream page |
| Type | Dancing Script + Cormorant + Cinzel letterspaced caps | Symphony script 48–52px vs 10–14px all-caps Playfair (1–4px tracking) | Arabic serif, verse-led |
| Signature moves | hairline-rule date block, thin line-art icons, floating botanicals, preloader with names | tap-to-start monogram seal, dot indicator, closing tilted polaroid slide-in, copy-button gift account | verse → parents invite → houses → cathedral → venue → Whish → RSVP → "وابتدأ المشوار" |
| Weaknesses we beat | admin chrome leaking, EN/AR copy drift, swipe-only nav | hand-cloned per client, no French, +1 RSVP cap | plain, no motion |

**The shared market blueprint:** personalized greeting → verse → families invite →
huge script names → date + countdown → groom's/bride's houses → ceremony →
celebration → gift registry (Whish) → RSVP with deadline → scripted closing. Music
behind a tap-to-start gate; photography is the palette; monochrome type over scrims;
mobile-first (WhatsApp delivery).

Our platform already has every *functional* piece (tokens, trilingual, houses in
`locations.kind`, deadline RSVP, music gate, monogram). The uplift is purely
presentational — exactly what the template module system was built for.

## Design decisions

### 1. Self-hosted fonts (CSP `font-src 'self'` intact)
`static/fonts/` + `src/lib/styles/fonts.css` (generated, OFL licenses):
- **Cormorant Garamond** 300–600 + italics — display serif (body of the luxury look)
- **Great Vibes** — script accent for couple names (latin; Arabic falls through to Amiri)
- **Cinzel** 400–700 variable — letterspaced stationery caps, dates, numerals
- **Amiri** 400/700 + italic — classical naskh for formal Arabic (matches wendlb AR mode)
- **Jost** 300–700 variable + italic — quiet geometric sans for body/UI
Imported once in the root layout. `DEFAULT_THEME.fonts` updated to the new stacks;
presets inherit. Font vars exposed to templates: `--ei-font-display`, `--ei-font-body`
(from theme) plus fixed art-direction faces `--ei-font-script` (Great Vibes→Amiri)
and `--ei-font-caps` (Cinzel→display) set by the dispatcher.

### 2. Bundled stock photography (no-upload constraint intact)
12 curated Pexels photos (license: free commercial use, no attribution) in
`static/photos/`, all **anonymous** (backs, hands, rings, tables, silhouettes — no
recognizable faces in the default sets, so a real couple is never misrepresented).
Templates that receive no `theme.images` fall back to a per-template curated stock
set (resolved in the dispatcher), so every template is photo-dressed by default.
Owner-placed R2 keys still take priority. `usesImages` hint in the studio picker
becomes "photo tips" copy.

### 3. Template art direction
- **slides → "the signature deck"** (roy-lara/wendlb class): fixed Ken Burns
  crossfade slideshow behind all slides + ink scrim; monochrome ivory type;
  script names; Cinzel letterspaced labels; hairline-rule date block; thin
  line-art SVG icons; vertical dot progress; frosted-glass RSVP card; closing
  polaroid with monogram seal. Vertical scroll-snap kept (better than swipe-only:
  works on desktop, keyboard, screen readers). Cover = full-bleed photo + seal.
- **edges → "the story"** (cclab-class formal, light): keeps torn-paper bands +
  petals signature; adds verse-led formal opening (quote marks, parents in caps),
  ornament flourishes, monogram seal, refined polaroid ending, band photos from
  stock set by default.
- **cinematic → "the editorial"**: ink-and-gold loading curtain (names + hairline
  progress), Ken Burns hero, numbered editorial panels with gold hairlines,
  letterboxed photo frames, seal-ring outro.
- Shared components (Countdown, Locations, Schedule, RsvpForm, Closing) restyled
  once: Cinzel numerals, line-art location icons (house/church/glasses/pin),
  hairline dividers — inherited by all templates.

### 4. Color presets
`classic` retuned to ivory/ink/gold (`#faf7f1/#23201c/#b8966e/#8f8577` — the wendlb
luxury system), `midnight` retuned to ink/gold. New: `olive` (sage), `burgundy`,
`blush`. Slides template re-scopes surface vars to monochrome-over-photo (references
prove zero-brand-color is the premium look) while keeping `--ei-accent`.

### 5. WhatsApp presentation
`og:image` added to the guest page head (first theme image, else the template's
stock hero) — absolute URL. This is how the invitation looks in the chat bubble;
references treat it as a feature.

### 6. Landing page `/`
Placeholder → luxury storefront: ivory/gold, Cinzel eyebrows, Cormorant hero,
Great Vibes accents, the three templates presented as a product line. No CMS, no
forms — a calling card.

## Constraints preserved (docs/templates.md rules)
Theme colors/fonts via `--ei-*` vars; `letter-spacing: 0` under `[dir='rtl']`;
no external origins (fonts/photos self-hosted); content renders without JS;
music never gates content; `data-section` + `#slide-0` contracts; e2e selectors
(`For {name}`, "Open Invitation", `.band`, `.curtain`, mute button) unchanged.
Existing saved themes parse unchanged (schema untouched except default values).

## Testing
- All existing unit + e2e specs must stay green (contracts above).
- New unit coverage: stock-set fallback resolution (images present vs absent).
- Visual verification: Playwright screenshots of all 3 templates × en/ar,
  reviewed by eye before deploy.

## Out of scope
Studio redesign (already usable), swipe-horizontal mode, table planner,
WhatsApp RSVP notifications (separate backlog), copy-to-clipboard gift account
(needs a structured field, not free text — future).
