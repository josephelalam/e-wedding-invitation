# Invitation template modules

Every event picks a **layout template** in Studio → event → Theme. All
templates share the same platform contract — personalization from the token,
gesture-unlocked music, trilingual i18n, the progressive RSVP pipeline, edge
caching — so a new module is purely presentation work.

## Shipped modules

| id          | Name             | Signature                                                                              |
| ----------- | ---------------- | -------------------------------------------------------------------------------------- |
| `slides`    | Signature Deck   | Ken Burns photo wall + scrim behind scroll-snap slides, monochrome ivory, dot rail     |
| `edges`     | Torn-Paper Story | formal long scroll: verse → families → photos torn like paper between cards, petals    |
| `cinematic` | Horizon          | horizontal scroll-snap deck: cover gate → formal → ledger → houses → venues → polaroid |

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

## Photos (hard constraint #1 intact)

Every template is photo-dressed by default: when `theme.images` is empty it
falls back to the bundled anonymous stock set in `src/lib/templates/stock.ts`
(`static/photos/*.jpg`, Pexels license). Owner photos are `theme.images` — R2
keys under `theme/…`, **placed manually** (there is deliberately no upload UI):

```bash
npx wrangler r2 object put einvite-media/theme/<slug>/1.jpg --file photo.jpg --remote
```

Then list the keys in Studio → Theme → Photos (one per line). Try instantly
with the pre-uploaded demo set: `theme/demo/1.svg` … `theme/demo/4.svg`.

## Adding a new module

1. `src/lib/templates/<id>/Template.svelte` — implement `TemplateProps`
   (`src/lib/templates/types.ts`): you receive `data` (event, guest,
   locations, theme), `ctx` (resolved localized texts, image URLs, formatted
   date, monogram, `rsvpIsClosed`), `opened`/`onopen` (the audio-unlock
   gesture — call it from your start button), and RSVP state.
2. Reuse the shared pieces where they fit: `templates/shared/RsvpBlock.svelte`
   (deadline-aware RSVP), `Petals.svelte`, and the section components
   (`Countdown`, `Locations`, `Schedule`). Wrap content in `use:inview` for
   the shared entrance reveal.
3. Add the id to `TEMPLATE_IDS` (`src/lib/themes/schema.ts`) and register it
   in `src/lib/templates/registry.ts` (name + tagline shown in the studio
   picker).
4. Rules every module must keep: theme colors/fonts come from the `--ei-*`
   CSS variables; `letter-spacing: 0` for RTL (Arabic never tracks — every
   tracked-caps rule needs the `[dir='rtl']` reset, including `text-indent`);
   no external origins (CSP is self + Turnstile only); content must render
   without JS (reveal classes are JS-added); music is an enhancement, never a
   gate; include an element with `data-section="rsvp"` and `id="slide-0"` as
   the post-open scroll target. The `gifts` section renders only when the
   owner filled the gifts note text.
5. Seed a fixture event in `tests/seed/seed-e2e.ts` and add a spec to
   `tests/e2e/templates.spec.ts` asserting the module's signature elements +
   one RSVP round-trip.

## Operational notes

- Guest HTML is edge-cached **120 s** — after a deploy, a guest can hold HTML
  that references the previous build's hashed chunks for up to that window;
  keep it short, don't raise it.
- Local dev: wrangler's Cache API persists in `.wrangler/state/v3/cache` and
  survives restarts; `npm run seed:e2e` clears it. Never delete that folder
  while `wrangler dev` is running (the cache worker wedges — restart it).
