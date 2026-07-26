# Invitation template modules

Every event picks a **layout template** in Studio → event → Theme. All
templates share the same platform contract — personalization from the token,
gesture-unlocked music, trilingual i18n, the progressive RSVP pipeline, edge
caching — so a new module is purely presentation work.

## Shipped modules

| id          | Name              | Signature                                                         |
| ----------- | ----------------- | ----------------------------------------------------------------- |
| `slides`    | Envelope & Slides | cover → scroll-snap full-screen slides (the original)             |
| `edges`     | Torn-Paper Story  | long scroll, photos torn like paper between cards, falling petals |
| `cinematic` | Cinematic Reveal  | % loading curtain → full-bleed hero → fade-in panels              |

## Photos (hard constraint #1 intact)

Photo templates read `theme.images` — R2 keys under `theme/…`, **placed
manually** (there is deliberately no upload UI):

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
   CSS variables; `letter-spacing: 0` for RTL (Arabic never tracks); no
   external origins (CSP is self + Turnstile only); content must render
   without JS (reveal classes are JS-added); music is an enhancement, never a
   gate; include an element with `data-section="rsvp"` and `id="slide-0"` as
   the post-open scroll target.
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
