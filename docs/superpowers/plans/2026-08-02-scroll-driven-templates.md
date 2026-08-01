# Scroll-Driven Template Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two new invitation layouts — `depth` (zero-dependency, scroll-scrubbed parallax) and `overture` (`depth` plus a lazy three.js envelope) — on one shared scroll-progress engine.

**Architecture:** A single `requestAnimationFrame` loop writes a normalized `--p` custom property (0→1) onto registered elements; all choreography is authored declaratively in CSS off that variable. Because every driven property uses `var(--p, <settled value>)`, "no JS" and "reduced motion" are both implemented by simply not registering — there is no second code path. `overture` adds one component, `Envelope.svelte`, which renders a CSS 3D envelope and optionally upgrades itself to three.js, then disposes entirely at scrub end.

**Tech Stack:** SvelteKit 2 + Svelte 5 runes, TypeScript, Cloudflare Workers (adapter-cloudflare), Vitest, Playwright, three.js (lazy chunk only).

**Design spec:** `docs/superpowers/specs/2026-08-02-scroll-driven-templates-design.md`

## Global Constraints

Every task's requirements implicitly include this section.

- **Node:** the shell default is v8.17.0 and will fail every tool. Prefix every command in this plan with `export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"` (matches `.nvmrc`, which pins 22).
- **Progressive enhancement:** content must render without JS (`docs/templates.md` rule 4). Every `--p`-driven property MUST be written as `var(--p, X)` where `X` is the settled value.
- **Reduced motion:** the engine returns early when `prefers-reduced-motion: reduce` matches, exactly as `src/lib/actions/inview.ts` already does.
- **RTL:** Arabic never tracks. Every `letter-spacing` / `text-indent` rule needs a `:global([dir='rtl'])` reset. Only the envelope needs directional mirroring; the parallax is purely vertical.
- **CSP:** `default-src 'self'`, no `worker-src` override (`vite.config.ts`). No blob workers, no DRACO, no external origins, no `unsafe-eval`. Envelope geometry is procedural.
- **Theme vars:** all color/font values come from `--ei-bg`, `--ei-text`, `--ei-accent`, `--ei-muted`, `--ei-font-display`, `--ei-font-body`, `--ei-font-script`, `--ei-font-caps`.
- **Module contract:** every template must expose an element with `data-section="rsvp"` and one with `id="slide-0"` as the post-open scroll target.
- **Bundle:** `three` must reach guests only through `overture`'s async chunk. Hard ceiling 150 KB gzipped.
- **Engine performance:** zero `getBoundingClientRect` calls inside the rAF loop; offsets cached at registration, refreshed on `ResizeObserver`.

---

## File Structure

| File                                         | Responsibility                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/actions/scroll-progress.ts`         | CREATE — pure progress math + the shared rAF engine + `progress` action             |
| `src/lib/templates/shared/ScrollBody.svelte` | CREATE — parallax shell; renders `theme.slideOrder` via existing section components |
| `src/lib/templates/shared/Envelope.svelte`   | CREATE — CSS 3D envelope, owns the optional WebGL upgrade                           |
| `src/lib/templates/shared/envelope-webgl.ts` | CREATE — procedural three.js scene; the lazy chunk                                  |
| `src/lib/templates/depth/Template.svelte`    | CREATE — `Cover` + `ScrollBody`                                                     |
| `src/lib/templates/overture/Template.svelte` | CREATE — `Envelope` + `ScrollBody`                                                  |
| `src/lib/themes/schema.ts:17`                | MODIFY — extend `TEMPLATE_IDS`                                                      |
| `src/lib/templates/registry.ts`              | MODIFY — register both modules                                                      |
| `tests/unit/scroll-progress.test.ts`         | CREATE — progress math table tests                                                  |
| `tests/unit/registry.test.ts`                | CREATE — every `TEMPLATE_ID` has an entry                                           |
| `tests/unit/bundle.test.ts`                  | CREATE — `three` is async-only                                                      |
| `tests/seed/fixtures-e2e.ts`                 | MODIFY — slugs, event ids, tokens for both                                          |
| `tests/seed/seed-e2e.ts`                     | MODIFY — two fixture events                                                         |
| `tests/e2e/templates.spec.ts`                | MODIFY — specs for both + reduced-motion + no-JS                                    |
| `docs/templates.md`                          | MODIFY — shipped-modules table + engine note                                        |

---

### Task 1: The scroll-progress engine

**Files:**

- Create: `src/lib/actions/scroll-progress.ts`
- Test: `tests/unit/scroll-progress.test.ts`

**Interfaces:**

- Consumes: nothing.
- Produces:
  - `computeProgress(scrollY: number, vh: number, top: number, height: number): number` — clamped 0..1
  - `pageProgress(scrollY: number, vh: number, docHeight: number): number` — clamped 0..1
  - `progress: Action<HTMLElement, ProgressMode | undefined>` where `type ProgressMode = 'view' | 'page'`
  - The action sets the CSS custom property `--p` on its node.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/scroll-progress.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeProgress, pageProgress } from '../../src/lib/actions/scroll-progress';

// p = 0 when the element's top edge meets the viewport bottom,
// p = 1 when its bottom edge meets the viewport top.
describe('computeProgress (view mode)', () => {
	const vh = 800;

	it('is 0 before the element enters the viewport', () => {
		expect(computeProgress(0, vh, 2000, 400)).toBe(0);
	});

	it('is 0 exactly as the top edge touches the viewport bottom', () => {
		expect(computeProgress(1200, vh, 2000, 400)).toBe(0);
	});

	it('is 1 exactly as the bottom edge touches the viewport top', () => {
		expect(computeProgress(2400, vh, 2000, 400)).toBe(1);
	});

	it('is 0.5 at the midpoint of the transit', () => {
		expect(computeProgress(1800, vh, 2000, 400)).toBeCloseTo(0.5, 5);
	});

	it('clamps above 1 once the element is fully past', () => {
		expect(computeProgress(9999, vh, 2000, 400)).toBe(1);
	});

	it('handles an element taller than the viewport', () => {
		// transit range = height + vh = 2400
		expect(computeProgress(1200, vh, 2000, 1600)).toBe(0);
		expect(computeProgress(3600, vh, 2000, 1600)).toBe(1);
		expect(computeProgress(2400, vh, 2000, 1600)).toBeCloseTo(0.5, 5);
	});

	it('returns 0 for a degenerate zero range rather than dividing by zero', () => {
		expect(computeProgress(500, 0, 0, 0)).toBe(0);
	});
});

describe('pageProgress', () => {
	it('is 0 at the top of the document', () => {
		expect(pageProgress(0, 800, 3200)).toBe(0);
	});

	it('is 1 at the bottom of the document', () => {
		expect(pageProgress(2400, 800, 3200)).toBe(1);
	});

	it('is 0.5 halfway down the scrollable extent', () => {
		expect(pageProgress(1200, 800, 3200)).toBeCloseTo(0.5, 5);
	});

	it('returns 0 when the document is not scrollable', () => {
		expect(pageProgress(0, 800, 800)).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run test:unit -- --run tests/unit/scroll-progress.test.ts
```

Expected: FAIL — `Failed to resolve import "../../src/lib/actions/scroll-progress"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/actions/scroll-progress.ts`:

```ts
/**
 * Scroll progress as a CSS custom property.
 *
 * One rAF loop serves every registered element. Per frame it reads
 * `window.scrollY` once and then does nothing but arithmetic and
 * `style.setProperty` — element offsets are cached at registration and
 * refreshed only on resize, so the loop never forces layout.
 *
 * Choreography stays declarative in CSS. Every driven property must be
 * written `var(--p, X)` where X is the settled value, so a guest with no JS
 * (or `prefers-reduced-motion`) sees the element at rest with no second
 * code path — see the design spec §3.4.
 */
import type { Action } from 'svelte/action';

export type ProgressMode = 'view' | 'page';

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** 0 when the top edge meets the viewport bottom, 1 when the bottom edge meets the viewport top. */
export function computeProgress(scrollY: number, vh: number, top: number, height: number): number {
	const range = height + vh;
	if (range <= 0) return 0;
	return clamp01((scrollY + vh - top) / range);
}

/** 0 at the top of the document, 1 at the bottom of the scrollable extent. */
export function pageProgress(scrollY: number, vh: number, docHeight: number): number {
	const range = docHeight - vh;
	if (range <= 0) return 0;
	return clamp01(scrollY / range);
}

type Entry = {
	node: HTMLElement;
	mode: ProgressMode;
	top: number;
	height: number;
	last: number;
	visible: boolean;
};

const entries = new Set<Entry>();
let frame = 0;
let observer: IntersectionObserver | undefined;
let resizeObserver: ResizeObserver | undefined;
let listening = false;

function measure(entry: Entry) {
	let top = 0;
	let node: HTMLElement | null = entry.node;
	while (node) {
		top += node.offsetTop;
		node = node.offsetParent as HTMLElement | null;
	}
	entry.top = top;
	entry.height = entry.node.offsetHeight;
}

function tick() {
	frame = 0;
	const scrollY = window.scrollY;
	const vh = window.innerHeight;
	const docHeight = document.documentElement.scrollHeight;
	let active = false;

	for (const entry of entries) {
		if (!entry.visible) continue;
		active = true;
		const value =
			entry.mode === 'page'
				? pageProgress(scrollY, vh, docHeight)
				: computeProgress(scrollY, vh, entry.top, entry.height);
		// Writing an identical value still invalidates style; skip the no-op.
		if (value !== entry.last) {
			entry.last = value;
			entry.node.style.setProperty('--p', value.toFixed(4));
		}
	}

	if (active && !document.hidden) frame = requestAnimationFrame(tick);
}

function wake() {
	if (frame || document.hidden) return;
	frame = requestAnimationFrame(tick);
}

function ensureGlobals() {
	if (listening) return;
	listening = true;

	observer = new IntersectionObserver((records) => {
		for (const record of records) {
			for (const entry of entries) {
				if (entry.node !== record.target) continue;
				// The page-mode plane is position:fixed and always intersecting;
				// view-mode entries park the loop once they leave.
				entry.visible = record.isIntersecting;
			}
		}
		wake();
	});

	resizeObserver = new ResizeObserver(() => {
		for (const entry of entries) measure(entry);
		wake();
	});
	resizeObserver.observe(document.documentElement);

	window.addEventListener('scroll', wake, { passive: true });
	window.addEventListener('resize', wake, { passive: true });
	document.addEventListener('visibilitychange', wake);
}

export const progress: Action<HTMLElement, ProgressMode | undefined> = (node, mode = 'view') => {
	// No JS-driven motion for reduced-motion guests: leaving --p unset makes
	// every `var(--p, X)` resolve to its settled value.
	if (typeof window === 'undefined') return {};
	if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return {};
	if (typeof IntersectionObserver === 'undefined' || typeof ResizeObserver === 'undefined') {
		return {};
	}

	ensureGlobals();
	const entry: Entry = { node, mode, top: 0, height: 0, last: -1, visible: false };
	measure(entry);
	entries.add(entry);
	observer?.observe(node);
	wake();

	return {
		destroy() {
			observer?.unobserve(node);
			entries.delete(entry);
			node.style.removeProperty('--p');
		}
	};
};
```

- [ ] **Step 4: Run test to verify it passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run test:unit -- --run tests/unit/scroll-progress.test.ts
```

Expected: PASS, 11 tests.

- [ ] **Step 5: Typecheck and lint**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run check && npm run lint
```

Expected: no errors. If `npm run lint` reports formatting, run `npm run format` and re-run.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/scroll-progress.ts tests/unit/scroll-progress.test.ts
git commit -m "feat(templates): shared scroll-progress engine

One rAF loop writes --p (0..1) onto registered elements. Offsets are
cached at registration and refreshed on resize, so the loop reads
scrollY once per frame and never forces layout. Parks when nothing
registered is on screen or the tab is hidden."
```

---

### Task 2: `ScrollBody` shell and the `depth` template

**Files:**

- Create: `src/lib/templates/shared/ScrollBody.svelte`
- Create: `src/lib/templates/depth/Template.svelte`
- Modify: `src/lib/themes/schema.ts:17`
- Modify: `src/lib/templates/registry.ts`
- Test: `tests/unit/registry.test.ts`

**Interfaces:**

- Consumes: `progress` from Task 1; `TemplateProps` from `src/lib/templates/types.ts`.
- Produces: `ScrollBody` accepting exactly `TemplateProps` minus `onopen`/`opened` — i.e. props `{ data, ctx, currentRsvp, errorKey, preview }`. Task 4 mounts the same component.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/registry.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { TEMPLATES } from '../../src/lib/templates/registry';
import { TEMPLATE_IDS, parseTheme } from '../../src/lib/themes/schema';

describe('template registry', () => {
	it('has an entry for every declared template id', () => {
		for (const id of TEMPLATE_IDS) {
			expect(TEMPLATES[id], `missing registry entry for "${id}"`).toBeDefined();
			expect(TEMPLATES[id].id).toBe(id);
			expect(TEMPLATES[id].name.length).toBeGreaterThan(0);
			expect(TEMPLATES[id].tagline.length).toBeGreaterThan(0);
			expect(TEMPLATES[id].component).toBeDefined();
		}
	});

	it('declares no registry entry without a declared id', () => {
		expect(Object.keys(TEMPLATES).sort()).toEqual([...TEMPLATE_IDS].sort());
	});

	it('accepts depth as a stored template', () => {
		expect(parseTheme({ template: 'depth' }).template).toBe('depth');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run test:unit -- --run tests/unit/registry.test.ts
```

Expected: FAIL on the `depth` case — `Invalid enum value. Expected 'slides' | 'edges' | 'cinematic'`.

- [ ] **Step 3: Create `ScrollBody.svelte`**

Create `src/lib/templates/shared/ScrollBody.svelte`:

```svelte
<script lang="ts">
	import Hero from '$lib/components/sections/Hero.svelte';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import Icon from '$lib/components/sections/Icon.svelte';
	import GiftAccount from '$lib/components/sections/GiftAccount.svelte';
	import Closing from '$lib/components/sections/Closing.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import Slideshow from '$lib/templates/shared/Slideshow.svelte';
	import { progress } from '$lib/actions/scroll-progress';
	import { t } from '$lib/i18n';
	import type { InviteData, TemplateCtx } from '$lib/templates/types';
	import type { RsvpView } from '$lib/types';

	// The parallax shell shared by `depth` and `overture`: a fixed photo plane
	// drifting at ~0.3x behind a content column at 1.0x. All choreography is
	// CSS off --p; the section components are reused untouched.
	let {
		data,
		ctx,
		currentRsvp,
		errorKey,
		preview
	}: {
		data: InviteData;
		ctx: TemplateCtx;
		currentRsvp: RsvpView;
		errorKey: string | null;
		preview: boolean;
	} = $props();

	const sections = $derived(
		data.theme.slideOrder.filter((section) => {
			if (section === 'locations') return data.locations.length > 0;
			if (section === 'schedule') return data.event.datesExtra.length > 0;
			if (section === 'gifts') return Boolean(ctx.giftsText) || Boolean(data.theme.giftsAccount);
			return true;
		})
	);

	// Interactive sections never recede — an RSVP form must not fade while a
	// guest is typing, and the registry number must stay legible while copied.
	const holds = (section: string) => section === 'rsvp' || section === 'gifts';

	// A photo band after every second section, cycling the owner's set.
	const bandFor = (index: number) =>
		index % 2 === 1 && ctx.imageUrls.length > 0
			? ctx.imageUrls[((index - 1) / 2) % ctx.imageUrls.length]
			: null;
</script>

<div class="scroll-body">
	<div class="photo-plane" use:progress={'page'} aria-hidden="true">
		<Slideshow images={ctx.imageUrls} videoUrl={ctx.videoUrl} scrim={0.5} />
	</div>

	<div class="column">
		{#each sections as section, index (section)}
			<section
				class="plane"
				class:hold={holds(section)}
				id={index === 0 ? 'slide-0' : undefined}
				data-section={section}
				use:progress
			>
				<div class="plane-inner">
					{#if section === 'hero'}
						<Hero title={ctx.title} welcome={ctx.welcomeText} dateFull={ctx.dateFull} />
					{:else if section === 'countdown'}
						<Countdown targetIso={data.event.dateMain} lang={ctx.lang} />
					{:else if section === 'locations'}
						<Locations locations={data.locations} lang={ctx.lang} />
					{:else if section === 'schedule'}
						<Schedule datesExtra={data.event.datesExtra} lang={ctx.lang} />
					{:else if section === 'gifts'}
						<div class="gifts">
							<span class="gift-badge"><Icon name="gift" /></span>
							<h2 class="gift-heading">{t(ctx.lang, 'gifts.title')}</h2>
							{#if ctx.giftsText}<p class="gift-text">{ctx.giftsText}</p>{/if}
							{#if data.theme.giftsAccount}
								<GiftAccount
									label={data.theme.giftsAccountLabel}
									account={data.theme.giftsAccount}
									lang={ctx.lang}
								/>
							{/if}
						</div>
					{:else if section === 'rsvp'}
						<div class="glass">
							<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
						</div>
					{:else if section === 'closing'}
						<Closing text={ctx.closingText} monogram={ctx.monogram} />
					{/if}
				</div>
			</section>

			{#if bandFor(index)}
				<div class="band" use:progress aria-hidden="true">
					<div class="band-image" style="background-image:url('{bandFor(index)}')"></div>
				</div>
			{/if}
		{/each}
	</div>
</div>

<style>
	.scroll-body {
		position: relative;
	}

	/* The section components ship their own use:inview entrance. Inside the
	   scroll shell the plane owns the choreography, so neutralize the
	   inherited reveal rather than editing every section component. */
	.scroll-body :global(.reveal) {
		opacity: 1;
		transform: none;
		filter: none;
		transition: none;
	}

	.photo-plane {
		position: fixed;
		inset: -8vh 0;
		z-index: 0;
		/* drifts -14vh across the whole page against content at 1.0x */
		transform: translate3d(0, calc(var(--p, 0) * -14vh), 0);
		will-change: transform;
	}

	.column {
		position: relative;
		z-index: 1;
	}

	.plane {
		min-height: 100svh;
		display: grid;
		place-items: center;
		padding: 12vh 1.6rem;
		box-sizing: border-box;
	}

	.plane-inner {
		display: grid;
		place-items: center;
		width: 100%;
		/* enter 0 -> 0.25, settled, recede 0.85 -> 1 */
		--enter: clamp(0, calc(var(--p, 1) * 4), 1);
		--exit: clamp(0, calc((var(--p, 0) - 0.85) * 6.667), 1);
		opacity: calc(var(--enter) * (1 - var(--exit)));
		transform: translateY(calc((1 - var(--enter)) * 40px + var(--exit) * -24px));
		filter: blur(calc((1 - var(--enter)) * 4px + var(--exit) * 3px));
	}

	.plane.hold .plane-inner {
		--exit: 0;
	}

	.band {
		height: 62svh;
		overflow: hidden;
	}

	.band-image {
		height: 100%;
		background-size: cover;
		background-position: center;
		/* settles from 1.15 to 1.0 across its transit */
		transform: scale(calc(1.15 - var(--p, 1) * 0.15));
		will-change: transform;
	}

	.glass {
		width: min(30rem, 100%);
		padding: 2rem 1.4rem;
		background: color-mix(in srgb, var(--ei-bg) 78%, transparent);
		backdrop-filter: blur(10px);
		border: 1px solid color-mix(in srgb, var(--ei-accent) 26%, transparent);
	}

	.gifts {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		max-width: 28rem;
	}

	.gift-badge {
		color: var(--ei-accent);
	}

	.gift-heading {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	.gift-text {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.15rem;
		line-height: 1.7;
		white-space: pre-line;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .gift-heading {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
```

- [ ] **Step 4: Create the `depth` template**

Create `src/lib/templates/depth/Template.svelte`:

```svelte
<script lang="ts">
	import Cover from '$lib/components/sections/Cover.svelte';
	import ScrollBody from '$lib/templates/shared/ScrollBody.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "depth" — a continuous scroll (no snap) so motion tracks the
	// guest's finger: a fixed photo plane drifting behind a content column,
	// each section settling in and receding out on its own progress.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();
</script>

<div class="depth" class:locked={!opened}>
	<Cover
		title={ctx.title}
		dateParts={ctx.dateParts}
		greeting={t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}
		openLabel={t(ctx.lang, 'cover.open')}
		monogram={ctx.monogram}
		{opened}
		{onopen}
	/>

	<ScrollBody {data} {ctx} {currentRsvp} {errorKey} {preview} />
</div>

<style>
	.depth {
		position: relative;
	}

	/* Everything below the cover stays out of reach until the open gesture
	   (which is also the audio unlock) — same convention as the deck layouts. */
	.depth.locked {
		height: 100svh;
		overflow: hidden;
	}
</style>
```

- [ ] **Step 5: Register the module**

In `src/lib/themes/schema.ts`, change line 17 from:

```ts
export const TEMPLATE_IDS = ['slides', 'edges', 'cinematic'] as const;
```

to:

```ts
export const TEMPLATE_IDS = ['slides', 'edges', 'cinematic', 'depth'] as const;
```

In `src/lib/templates/registry.ts`, add the import beside the others:

```ts
import DepthTemplate from './depth/Template.svelte';
```

and add this entry to the `TEMPLATES` object, after `cinematic`:

```ts
	depth: {
		id: 'depth',
		name: 'Depth — Parallax Story',
		tagline:
			'A continuous scroll with real depth: the photo wall drifts behind the words, each page settles in and recedes as you pass, photo bands breathe between them.',
		usesImages: true,
		component: DepthTemplate
	}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run test:unit -- --run tests/unit/registry.test.ts
```

Expected: PASS, 3 tests.

- [ ] **Step 7: Typecheck, lint, and see it in the browser**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run check && npm run lint
npm run seed && npm run dev
```

Open `http://localhost:5173/e/e2e-wedding/preview?template=depth`. Confirm: the cover renders, clicking Open releases the lock, the photo plane drifts slower than the text, sections fade in and recede, and the RSVP section does **not** fade while focused.

- [ ] **Step 8: Commit**

```bash
git add src/lib/templates/shared/ScrollBody.svelte src/lib/templates/depth/ \
  src/lib/themes/schema.ts src/lib/templates/registry.ts tests/unit/registry.test.ts
git commit -m "feat(templates): add depth — parallax scroll layout

ScrollBody is the shared shell: fixed photo plane at 0.3x behind a
content column at 1.0x, sections settling in and receding on --p.
rsvp and gifts are enter-only so neither moves under a guest's hands.
Neutralizes the section components' inherited use:inview reveal inside
the shell rather than editing each component."
```

---

### Task 3: Signature choreography

**Files:**

- Modify: `src/lib/templates/shared/ScrollBody.svelte`

**Interfaces:**

- Consumes: `ScrollBody` from Task 2.
- Produces: no new exports. Adds a monogram ring overture and an engraved date block at the head of the column.

- [ ] **Step 1: Add the overture block markup**

In `src/lib/templates/shared/ScrollBody.svelte`, insert this immediately after `<div class="column">` and before the `{#each sections ...}` block:

```svelte
<div class="overture-block" use:progress>
	<svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
		<circle class="ring-track" cx="60" cy="60" r="54" />
		<circle class="ring-draw" cx="60" cy="60" r="54" />
	</svg>
	<p class="ring-mark" aria-hidden="true">{ctx.monogram}</p>

	<div class="engraved">
		<p class="rule-line" style="--slice:0">
			<span class="hairline"></span><span class="caps">{ctx.dateParts.weekday}</span><span
				class="hairline"
			></span>
		</p>
		<p class="daymonth" style="--slice:1">{ctx.dateParts.month} {ctx.dateParts.day}</p>
		<p class="rule-line" style="--slice:2">
			<span class="hairline"></span><span class="caps">{ctx.dateParts.year}</span><span
				class="hairline"
			></span>
		</p>
	</div>
</div>
```

- [ ] **Step 2: Add the choreography CSS**

Append these rules inside the `<style>` block of `ScrollBody.svelte`, before the RTL reset at the bottom:

```css
.overture-block {
	min-height: 100svh;
	display: grid;
	place-items: center;
	align-content: center;
	gap: 0.4rem;
	padding: 12vh 1.6rem;
	box-sizing: border-box;
	position: relative;
}

.ring {
	width: 8.5rem;
	height: 8.5rem;
	grid-area: 1 / 1;
	overflow: visible;
}

.ring-track,
.ring-draw {
	fill: none;
	stroke-width: 1;
	/* r=54 -> circumference = 2*pi*54 = 339.29 */
	--circ: 339.29;
}

.ring-track {
	stroke: color-mix(in srgb, var(--ei-accent) 18%, transparent);
}

.ring-draw {
	stroke: var(--ei-accent);
	stroke-dasharray: var(--circ);
	stroke-dashoffset: calc((1 - var(--p, 1)) * var(--circ));
	transform: rotate(-90deg);
	transform-origin: 60px 60px;
}

.ring-mark {
	grid-area: 1 / 1;
	margin: 0;
	place-self: center;
	font-family: var(--ei-font-display);
	font-size: 1.7rem;
	color: var(--ei-accent);
	opacity: var(--p, 1);
}

.engraved {
	margin-top: 2.4rem;
	width: min(20rem, 100%);
	text-align: center;
}

/* Each line lifts on its own slice of the same variable — pure CSS stagger,
	   no per-element JS. slice 0 starts at p=0.10, each next one 0.12 later. */
.engraved .rule-line,
.engraved .daymonth {
	--start: calc(0.1 + var(--slice) * 0.12);
	--step: clamp(0, calc((var(--p, 1) - var(--start)) * 4), 1);
	margin: 0;
	opacity: var(--step);
	transform: translateY(calc((1 - var(--step)) * 14px));
}

.rule-line {
	display: flex;
	align-items: center;
	gap: 0.9rem;
}

.rule-line .hairline {
	flex: 1;
	height: 1px;
	background: color-mix(in srgb, var(--ei-accent) 45%, transparent);
	transform: scaleX(var(--step));
}

.rule-line .caps {
	font-family: var(--ei-font-caps);
	font-size: 0.72rem;
	letter-spacing: 0.3em;
	text-indent: 0.3em;
	text-transform: uppercase;
	color: var(--ei-muted);
}

.daymonth {
	font-family: var(--ei-font-display);
	font-size: clamp(1.8rem, 7vw, 2.4rem);
	padding: 0.5rem 0;
}
```

Then extend the existing RTL reset at the bottom of the style block so it reads:

```css
/* Arabic script takes no tracking — letterspacing breaks connected letters */
:global([dir='rtl']) .gift-heading,
:global([dir='rtl']) .rule-line .caps {
	letter-spacing: 0;
	text-indent: 0;
}
```

- [ ] **Step 3: Verify the hairlines grow from centre, not from one edge**

`.hairline` uses `scaleX(var(--step))` with the default `transform-origin: center`, which is what the spec calls for. Confirm no `transform-origin` override was introduced.

- [ ] **Step 4: Typecheck, lint, and view**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run check && npm run lint
npm run dev
```

Open `http://localhost:5173/e/e2e-wedding/preview?template=depth`, open the invitation, and scroll. Confirm the ring draws clockwise from the top as the block transits, the monogram fades up with it, and the three date lines stagger rather than arriving together.

- [ ] **Step 5: Verify the reduced-motion rest state**

In devtools, open the Rendering panel and set `Emulate CSS prefers-reduced-motion: reduce`, then hard-reload. Confirm the ring is fully drawn, the monogram is fully opaque, all three date lines are visible and untranslated, and nothing moves while scrolling.

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/shared/ScrollBody.svelte
git commit -m "feat(templates): monogram ring draw and engraved date stagger

The ring is an SVG circle rather than stroked text, so it works for any
monogram glyph including Arabic with no font-loading dependency. The
date lines stagger on slices of the same --p, so the choreography stays
pure CSS with no per-element JS."
```

---

### Task 4: The CSS 3D envelope and the `overture` template

**Files:**

- Create: `src/lib/templates/shared/Envelope.svelte`
- Create: `src/lib/templates/overture/Template.svelte`
- Modify: `src/lib/themes/schema.ts:17`
- Modify: `src/lib/templates/registry.ts`

**Interfaces:**

- Consumes: `progress` (Task 1), `ScrollBody` (Task 2).
- Produces: `Envelope` with props `{ monogram: string; title: string; greeting: string; openLabel: string; photo: string | null; opened: boolean; onopen: () => void }`. Task 5 adds an internal WebGL upgrade behind the same props — no prop changes.

- [ ] **Step 1: Create `Envelope.svelte`**

Create `src/lib/templates/shared/Envelope.svelte`:

```svelte
<script lang="ts">
	import { progress } from '$lib/actions/scroll-progress';

	// The envelope overture: a sealed envelope whose flap opens and whose card
	// rises and fills the screen as the guest scrolls. CSS 3D is the default
	// renderer; Task 5 layers an optional WebGL upgrade on top of it.
	//
	// The tap is mandatory, not decorative: it is the audio-unlock gesture, and
	// iOS Safari will not start audio from a scroll.
	let {
		monogram,
		title,
		greeting,
		openLabel,
		photo = null,
		opened,
		onopen
	}: {
		monogram: string;
		title: string;
		greeting: string;
		openLabel: string;
		photo?: string | null;
		opened: boolean;
		onopen: () => void;
	} = $props();
</script>

<div class="stage" class:sealed={!opened} use:progress>
	<div class="sticky">
		<div class="env" aria-label={title}>
			<div class="card">
				{#if photo}
					<div class="card-photo" style="background-image:url('{photo}')"></div>
				{/if}
				<p class="card-mark" aria-hidden="true">{monogram}</p>
				<h1 class="card-title">{title}</h1>
			</div>

			<div class="back"></div>
			<div class="side left"></div>
			<div class="side right"></div>
			<div class="bottom"></div>
			<div class="flap"></div>
		</div>

		{#if !opened}
			<div class="gate">
				<p class="greeting">{greeting}</p>
				<button class="open" type="button" onclick={onopen}>{openLabel}</button>
			</div>
		{/if}
	</div>
</div>

<style>
	/* 200vh of scroll drives the open; the envelope is sticky inside it. */
	.stage {
		height: 200svh;
		position: relative;
	}

	.sticky {
		position: sticky;
		top: 0;
		height: 100svh;
		display: grid;
		place-items: center;
		perspective: 1400px;
		overflow: hidden;
	}

	/* Before the gesture the guest cannot scroll past the envelope. */
	.stage.sealed {
		height: 100svh;
	}

	.env {
		position: relative;
		width: min(22rem, 82vw);
		aspect-ratio: 3 / 2;
		transform-style: preserve-3d;
	}

	.back,
	.side,
	.bottom,
	.flap {
		position: absolute;
		inset: 0;
		background: color-mix(in srgb, var(--ei-bg) 92%, var(--ei-accent));
		border: 1px solid color-mix(in srgb, var(--ei-accent) 30%, transparent);
	}

	.back {
		transform: translateZ(-1px);
	}

	.side,
	.bottom {
		background: color-mix(in srgb, var(--ei-bg) 86%, var(--ei-accent));
	}

	.side.left {
		clip-path: polygon(0 0, 50% 50%, 0 100%);
	}

	.side.right {
		clip-path: polygon(100% 0, 100% 100%, 50% 50%);
	}

	.bottom {
		clip-path: polygon(0 100%, 50% 50%, 100% 100%);
		z-index: 3;
	}

	/* p 0 -> 0.35: flap rotates open about its top edge. */
	.flap {
		clip-path: polygon(0 0, 100% 0, 50% 50%);
		transform-origin: top center;
		transform: rotateX(calc(clamp(0, calc(var(--p, 1) * 2.857), 1) * -170deg));
		z-index: 4;
		backface-visibility: hidden;
	}

	/* p 0.35 -> 0.75: the card rises out. p 0.75 -> 1: it scales to fill. */
	.card {
		position: absolute;
		inset: 6% 5%;
		--rise: clamp(0, calc((var(--p, 1) - 0.35) * 2.5), 1);
		--fill: clamp(0, calc((var(--p, 1) - 0.75) * 4), 1);
		z-index: 2;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.8rem;
		overflow: hidden;
		background: var(--ei-bg);
		border: 1px solid color-mix(in srgb, var(--ei-accent) 34%, transparent);
		/* --dir carries the writing direction so the transform is written once. */
		--dir: 1;
		transform: translate(calc(var(--dir) * var(--fill) * 4%), calc(var(--rise) * -55%))
			rotateX(calc((1 - var(--rise)) * 8deg)) scale(calc(1 + var(--fill) * 1.35));
		will-change: transform;
	}

	/* RTL mirrors the card's slight lateral drift on exit. */
	:global([dir='rtl']) .card {
		--dir: -1;
	}

	.card-photo {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		opacity: 0.28;
	}

	.card-mark {
		position: relative;
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.3rem;
		color: var(--ei-accent);
	}

	.card-title {
		position: relative;
		margin: 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(1.6rem, 6vw, 2.2rem);
		text-align: center;
		text-wrap: balance;
	}

	.gate {
		position: absolute;
		inset-block-end: 12vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
	}

	.greeting {
		margin: 0;
		font-family: var(--ei-font-display);
		color: var(--ei-muted);
	}

	.open {
		font-family: var(--ei-font-body);
		font-size: 0.7rem;
		font-weight: 500;
		letter-spacing: 0.24em;
		text-indent: 0.24em;
		text-transform: uppercase;
		color: inherit;
		background: transparent;
		border: 1px solid color-mix(in srgb, currentColor 45%, transparent);
		padding: 0.8rem 1.8rem;
		cursor: pointer;
	}

	.open:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .open {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
```

- [ ] **Step 2: Create the `overture` template**

Create `src/lib/templates/overture/Template.svelte`:

```svelte
<script lang="ts">
	import Envelope from '$lib/templates/shared/Envelope.svelte';
	import ScrollBody from '$lib/templates/shared/ScrollBody.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "overture" — `depth` preceded by a scroll-scrubbed envelope.
	// The envelope is the entire delta between the two layouts; everything
	// after it is the identical ScrollBody shell.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();
</script>

<div class="overture">
	<Envelope
		monogram={ctx.monogram}
		title={ctx.title}
		greeting={t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}
		openLabel={t(ctx.lang, 'cover.open')}
		photo={ctx.imageUrls[0] ?? null}
		{opened}
		{onopen}
	/>

	<ScrollBody {data} {ctx} {currentRsvp} {errorKey} {preview} />
</div>

<style>
	.overture {
		position: relative;
	}
</style>
```

- [ ] **Step 3: Register the module**

In `src/lib/themes/schema.ts`, change line 17 to:

```ts
export const TEMPLATE_IDS = ['slides', 'edges', 'cinematic', 'depth', 'overture'] as const;
```

In `src/lib/templates/registry.ts`, add the import:

```ts
import OvertureTemplate from './overture/Template.svelte';
```

and add this entry after `depth`:

```ts
	overture: {
		id: 'overture',
		name: 'Overture — The Envelope',
		tagline:
			'A sealed envelope that opens under the guest’s thumb: the flap lifts, the card rises and fills the screen, then the parallax story begins.',
		usesImages: true,
		component: OvertureTemplate
	}
```

- [ ] **Step 4: Run the registry test**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run test:unit -- --run tests/unit/registry.test.ts
```

Expected: PASS. The completeness assertions now cover five ids.

- [ ] **Step 5: Typecheck, lint, and view**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run check && npm run lint
npm run dev
```

Open `http://localhost:5173/e/e2e-wedding/preview?template=overture`. Confirm: the envelope is sealed and the page will not scroll past it; the tap releases it; scrolling lifts the flap, then raises the card, then scales it to fill; the `ScrollBody` sections follow. Set `prefers-reduced-motion: reduce` in devtools and confirm the envelope renders already-open and static.

- [ ] **Step 6: Commit**

```bash
git add src/lib/templates/shared/Envelope.svelte src/lib/templates/overture/ \
  src/lib/themes/schema.ts src/lib/templates/registry.ts
git commit -m "feat(templates): add overture — CSS 3D envelope opening

Six preserve-3d faces scrubbed by --p: flap to 0.35, card rise to 0.75,
fill to 1. The tap stays mandatory because it is the audio-unlock
gesture and iOS Safari will not start audio from a scroll. WebGL
upgrade lands next; this CSS version is the permanent fallback."
```

---

### Task 5: The three.js upgrade

**Files:**

- Create: `src/lib/templates/shared/envelope-webgl.ts`
- Modify: `src/lib/templates/shared/Envelope.svelte`
- Modify: `package.json`
- Test: `tests/unit/bundle.test.ts`

**Interfaces:**

- Consumes: `Envelope` from Task 4.
- Produces: `mountEnvelope(canvas: HTMLCanvasElement, options: { accent: string; paper: string; photo: string | null }): Promise<EnvelopeScene>` where `type EnvelopeScene = { setProgress(p: number): void; dispose(): void }`.

- [ ] **Step 1: Install three.js**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm install three && npm install --save-dev @types/three
```

- [ ] **Step 2: Write the failing bundle test**

Create `tests/unit/bundle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// three.js must reach guests ONLY through overture's async chunk. A guest on
// depth — or any pre-existing template — downloads zero extra bytes.
const CLIENT_DIR = '.svelte-kit/output/client/_app/immutable';

describe('bundle layout', () => {
	it('keeps three.js out of every eagerly-loaded chunk', () => {
		if (!existsSync(CLIENT_DIR)) {
			throw new Error(`run "npm run build" before this test — ${CLIENT_DIR} is missing`);
		}

		const entryDir = join(CLIENT_DIR, 'entry');
		const entryFiles = readdirSync(entryDir).filter((name) => name.endsWith('.js'));
		expect(entryFiles.length).toBeGreaterThan(0);

		for (const name of entryFiles) {
			const source = readFileSync(join(entryDir, name), 'utf8');
			expect(
				source.includes('WebGLRenderer'),
				`three.js leaked into the eager entry chunk ${name}`
			).toBe(false);
		}
	});

	it('emits the envelope WebGL scene as its own chunk under the size ceiling', async () => {
		const { gzipSync } = await import('node:zlib');
		const nodesDir = join(CLIENT_DIR, 'chunks');
		const files = readdirSync(nodesDir).filter((name) => name.endsWith('.js'));
		const webgl = files.find((name) =>
			readFileSync(join(nodesDir, name), 'utf8').includes('WebGLRenderer')
		);
		expect(webgl, 'no chunk containing three.js was emitted').toBeDefined();

		const gzipped = gzipSync(readFileSync(join(nodesDir, webgl as string))).byteLength;
		expect(gzipped, `three.js chunk is ${Math.round(gzipped / 1024)} KB gzipped`).toBeLessThan(
			150 * 1024
		);
	});
});
```

- [ ] **Step 3: Run the test to verify it fails**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run build && npm run test:unit -- --run tests/unit/bundle.test.ts
```

Expected: FAIL on the second case — `no chunk containing three.js was emitted`.

- [ ] **Step 4: Write the WebGL scene**

Create `src/lib/templates/shared/envelope-webgl.ts`:

```ts
/**
 * The envelope overture's optional WebGL renderer.
 *
 * This module is the lazy chunk: it is imported dynamically from
 * Envelope.svelte on the open gesture and must never be reachable from an
 * eager import, or three.js lands in every guest's bundle.
 *
 * Geometry is procedural — six planes, no loader, no asset fetch. That is a
 * CSP requirement, not a preference: vite.config.ts sets default-src 'self'
 * with no worker-src override, so DRACO's blob worker is blocked outright.
 */
import {
	AmbientLight,
	DirectionalLight,
	DoubleSide,
	Group,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	PlaneGeometry,
	Scene,
	SRGBColorSpace,
	TextureLoader,
	WebGLRenderer,
	type Texture
} from 'three';

export type EnvelopeScene = {
	setProgress(p: number): void;
	dispose(): void;
};

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
const slice = (p: number, from: number, to: number) => clamp01((p - from) / (to - from));

export async function mountEnvelope(
	canvas: HTMLCanvasElement,
	options: { accent: string; paper: string; photo: string | null }
): Promise<EnvelopeScene> {
	const renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
	renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);

	const scene = new Scene();
	const camera = new PerspectiveCamera(38, canvas.clientWidth / canvas.clientHeight, 0.1, 100);
	camera.position.set(0, 0, 6.2);

	scene.add(new AmbientLight(0xffffff, 1.1));
	const key = new DirectionalLight(0xffffff, 1.5);
	key.position.set(-2.5, 3.5, 4);
	scene.add(key);

	const paper = new MeshStandardMaterial({
		color: options.paper,
		roughness: 0.92,
		metalness: 0,
		side: DoubleSide
	});
	const lining = new MeshStandardMaterial({
		color: options.accent,
		roughness: 0.85,
		metalness: 0.05,
		side: DoubleSide
	});

	const W = 3.6;
	const H = 2.4;
	const geometries: PlaneGeometry[] = [];
	const plane = (w: number, h: number) => {
		const geometry = new PlaneGeometry(w, h);
		geometries.push(geometry);
		return geometry;
	};

	const group = new Group();
	scene.add(group);

	const back = new Mesh(plane(W, H), paper);
	back.position.z = -0.02;
	group.add(back);

	// The card: rises out of the envelope and scales to fill.
	let cardTexture: Texture | undefined;
	const cardMaterial = new MeshStandardMaterial({
		color: 0xffffff,
		roughness: 0.95,
		metalness: 0,
		side: DoubleSide
	});
	if (options.photo) {
		cardTexture = await new Promise<Texture | undefined>((resolve) => {
			new TextureLoader().load(
				options.photo as string,
				(texture) => {
					texture.colorSpace = SRGBColorSpace;
					resolve(texture);
				},
				undefined,
				() => resolve(undefined)
			);
		});
		if (cardTexture) cardMaterial.map = cardTexture;
	}
	const card = new Mesh(plane(W * 0.92, H * 0.88), cardMaterial);
	card.position.z = 0.01;
	group.add(card);

	// The flap: pivoted at its top edge, so the geometry is offset downward
	// inside a group whose rotation is the hinge.
	const flapHinge = new Group();
	flapHinge.position.set(0, H / 2, 0.03);
	const flap = new Mesh(plane(W, H / 2), lining);
	flap.position.y = -H / 4;
	flapHinge.add(flap);
	group.add(flapHinge);

	const front = new Mesh(plane(W, H * 0.62), paper);
	front.position.set(0, -H * 0.19, 0.04);
	group.add(front);

	let raf = 0;
	let progress = 0;
	let disposed = false;

	function apply() {
		const open = slice(progress, 0, 0.35);
		const rise = slice(progress, 0.35, 0.75);
		const fill = slice(progress, 0.75, 1);

		flapHinge.rotation.x = open * (-170 * (Math.PI / 180));
		card.position.y = rise * H * 0.62;
		card.rotation.x = (1 - rise) * 0.14;
		const scale = 1 + fill * 1.35;
		card.scale.set(scale, scale, 1);
		cardMaterial.opacity = 1;
		group.rotation.x = (1 - open) * 0.06;
	}

	function render() {
		raf = 0;
		if (disposed) return;
		apply();
		renderer.render(scene, camera);
	}

	function schedule() {
		if (raf || disposed) return;
		raf = requestAnimationFrame(render);
	}

	const onResize = () => {
		if (disposed) return;
		renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
		camera.aspect = canvas.clientWidth / canvas.clientHeight;
		camera.updateProjectionMatrix();
		schedule();
	};
	window.addEventListener('resize', onResize, { passive: true });

	schedule();

	return {
		setProgress(value: number) {
			progress = clamp01(value);
			schedule();
		},
		dispose() {
			if (disposed) return;
			disposed = true;
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('resize', onResize);
			for (const geometry of geometries) geometry.dispose();
			paper.dispose();
			lining.dispose();
			cardMaterial.dispose();
			cardTexture?.dispose();
			renderer.dispose();
			renderer.forceContextLoss();
		}
	};
}
```

- [ ] **Step 5: Wire the upgrade into `Envelope.svelte`**

In `src/lib/templates/shared/Envelope.svelte`, replace the entire `<script lang="ts">` block with:

```svelte
<script lang="ts">
	import { progress } from '$lib/actions/scroll-progress';
	import type { EnvelopeScene } from '$lib/templates/shared/envelope-webgl';

	// The envelope overture: a sealed envelope whose flap opens and whose card
	// rises and fills the screen as the guest scrolls. CSS 3D is the DEFAULT
	// renderer and the permanent fallback; three.js is an upgrade that swaps in
	// only when it can, and disposes itself the moment the scrub completes.
	//
	// The tap is mandatory, not decorative: it is the audio-unlock gesture, and
	// iOS Safari will not start audio from a scroll.
	let {
		monogram,
		title,
		greeting,
		openLabel,
		photo = null,
		opened,
		onopen
	}: {
		monogram: string;
		title: string;
		greeting: string;
		openLabel: string;
		photo?: string | null;
		opened: boolean;
		onopen: () => void;
	} = $props();

	let stage: HTMLElement | undefined = $state();
	let canvas: HTMLCanvasElement | undefined = $state();
	let webgl = $state(false);
	let scene: EnvelopeScene | undefined;

	function capable(): boolean {
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
		const connection = (navigator as { connection?: { saveData?: boolean } }).connection;
		if (connection?.saveData === true) return false;
		const memory = (navigator as { deviceMemory?: number }).deviceMemory;
		if (typeof memory === 'number' && memory < 4) return false;
		const probe = document.createElement('canvas').getContext('webgl2');
		if (!probe) return false;
		probe.getExtension('WEBGL_lose_context')?.loseContext();
		return true;
	}

	function currentProgress(): number {
		const raw = stage?.style.getPropertyValue('--p');
		return raw ? Number(raw) : 0;
	}

	// Fired by the open gesture, so the download overlaps the flap animation
	// the CSS version is already running.
	async function upgrade() {
		if (webgl || scene || !capable()) return;
		try {
			const module = await import('$lib/templates/shared/envelope-webgl');
			// A renderer swap mid-animation is worse than no upgrade at all.
			if (currentProgress() > 0.15 || !canvas) return;
			const styles = getComputedStyle(stage as HTMLElement);
			scene = await module.mountEnvelope(canvas, {
				accent: styles.getPropertyValue('--ei-accent').trim() || '#b8966e',
				paper: styles.getPropertyValue('--ei-bg').trim() || '#faf7f1',
				photo
			});
			webgl = true;
		} catch {
			// Guest HTML is edge-cached 120s, so after a deploy the chunk URL can
			// 404. A failed upgrade must be invisible: the CSS envelope stays.
		}
	}

	function handleOpen() {
		onopen();
		void upgrade();
	}

	// Feed the shared scroll progress to the scene, and free the GPU the moment
	// the overture is over.
	$effect(() => {
		if (!webgl || !scene || !stage) return;
		let raf = 0;
		const pump = () => {
			const p = currentProgress();
			scene?.setProgress(p);
			if (p >= 0.995) {
				scene?.dispose();
				scene = undefined;
				webgl = false;
				return;
			}
			raf = requestAnimationFrame(pump);
		};
		raf = requestAnimationFrame(pump);
		return () => {
			cancelAnimationFrame(raf);
			scene?.dispose();
			scene = undefined;
		};
	});
</script>
```

Then change the markup so the stage is bound and the canvas exists. Replace the opening `<div class="stage" ...>` line with:

```svelte
<div class="stage" class:sealed={!opened} class:webgl bind:this={stage} use:progress>
```

Immediately after `<div class="sticky">`, insert:

```svelte
<canvas class="gl" class:on={webgl} bind:this={canvas} aria-hidden="true"></canvas>
```

Change the button's handler from `onclick={onopen}` to `onclick={handleOpen}`.

Finally add these rules to the `<style>` block, just after the `.sticky` rule:

```css
.gl {
	position: absolute;
	inset: 0;
	width: 100%;
	height: 100%;
	opacity: 0;
	pointer-events: none;
}

.gl.on {
	opacity: 1;
}

/* When WebGL takes over, the CSS envelope steps aside — same scrub, same
	   geometry, so the handoff is invisible. */
.stage.webgl .env {
	opacity: 0;
}
```

- [ ] **Step 6: Rebuild and run the bundle test**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run build && npm run test:unit -- --run tests/unit/bundle.test.ts
```

Expected: PASS, 2 tests. If the size assertion fails, the fallback per the spec is a hand-rolled WebGL renderer or OGL — stop and report the measured size rather than raising the ceiling.

- [ ] **Step 7: Typecheck, lint, and verify both renderers**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run check && npm run lint
npm run dev
```

Open `http://localhost:5173/e/e2e-wedding/preview?template=overture`, tap Open, and scroll. Confirm the WebGL canvas takes over and the card lights and shadows. Then, in devtools, block the `envelope-webgl` chunk request (Network → right-click → Block request URL) and reload: confirm the CSS envelope runs the whole opening with no visual error. Finally, scroll past the overture and confirm in the Performance panel that no rAF work continues.

- [ ] **Step 8: Commit**

```bash
git add src/lib/templates/shared/envelope-webgl.ts src/lib/templates/shared/Envelope.svelte \
  tests/unit/bundle.test.ts package.json package-lock.json
git commit -m "feat(templates): three.js upgrade for the envelope overture

Procedural six-plane geometry — no loader, no asset fetch, nothing the
CSP blocks. Imported on the open gesture so the download overlaps the
CSS flap animation, and refused past p>0.15 because a renderer swap
mid-animation is worse than no upgrade. Disposes at scrub end so the
GPU idles for the rest of the visit. Bundle test pins three.js to an
async chunk under 150 KB gzipped."
```

---

### Task 6: End-to-end coverage

**Files:**

- Modify: `tests/seed/fixtures-e2e.ts`
- Modify: `tests/seed/seed-e2e.ts`
- Modify: `tests/e2e/templates.spec.ts`

**Interfaces:**

- Consumes: both templates from Tasks 2–5.
- Produces: `E2E.depthSlug`, `E2E.depthEventId`, `E2E.overtureSlug`, `E2E.overtureEventId`, `E2E.tokens.depth`, `E2E.tokens.overture`.

- [ ] **Step 1: Add the fixtures**

In `tests/seed/fixtures-e2e.ts`, add these keys to the `E2E` object — after `cineEventId` for the ids, and inside `tokens` for the tokens:

```ts
	depthSlug: 'e2e-depth',
	depthEventId: 'ev_e2e_5555555555',
	overtureSlug: 'e2e-overture',
	overtureEventId: 'ev_e2e_6666666666',
```

```ts
		depth: 'E2eDepthTok11111111111',
		overture: 'E2eOvertTok11111111111'
```

- [ ] **Step 2: Seed the two events**

In `tests/seed/seed-e2e.ts`, add these theme objects after `cineTheme` (line 65):

```ts
const depthTheme = {
	preset: 'classic',
	template: 'depth',
	monogram: 'D·P',
	effect: 'sparkles',
	images: ['theme/e2e/1.svg', 'theme/e2e/2.svg', 'theme/e2e/3.svg'],
	texts: {
		welcome: { en: 'Scroll gently — the day unfolds as you go.' },
		closing: { en: 'With all our love, always.' }
	}
};

const overtureTheme = {
	preset: 'classic',
	template: 'overture',
	monogram: 'O·V',
	images: ['theme/e2e/1.svg', 'theme/e2e/2.svg'],
	giftsAccountLabel: 'OMT',
	giftsAccount: '70 987 654',
	texts: {
		welcome: { en: 'The envelope is yours to open.' },
		gifts: { en: 'Your presence is the greatest gift.' },
		closing: { en: 'See you there.' }
	}
};
```

Extend the `DELETE FROM events` statement (line 72) to include the new slugs:

```ts
	`DELETE FROM events WHERE slug IN (${q(E2E.slug)}, ${q(E2E.otherSlug)}, ${q(E2E.edgesSlug)}, ${q(E2E.cineSlug)}, ${q(E2E.depthSlug)}, ${q(E2E.overtureSlug)});`,
```

Add this statement to the `statements` array, immediately after the `edges`/`cinematic` events INSERT (which ends at line 77):

```ts
	`INSERT INTO events (id, slug, type, title_en, title_ar, title_fr, date_main, dates_extra, theme, languages, status, payment_status, retention_months, created_at, updated_at)
VALUES (${q(E2E.depthEventId)}, ${q(E2E.depthSlug)}, 'wedding', 'Dana & Peter', ${q('دانا وبيتر')}, 'Dana & Peter',
 '2027-10-09T17:00', '[]', ${q(JSON.stringify(depthTheme))}, '["en","ar"]', 'live', 'pending', 6, ${q(now)}, ${q(now)}),
 (${q(E2E.overtureEventId)}, ${q(E2E.overtureSlug)}, 'wedding', 'Olivia & Victor', ${q('أوليفيا وفيكتور')}, 'Olivia & Victor',
 '2027-11-20T18:00', '[]', ${q(JSON.stringify(overtureTheme))}, '["en","fr"]', 'live', 'pending', 6, ${q(now)}, ${q(now)});`,
	`INSERT INTO locations (id, event_id, kind, label_en, maps_url, starts_at, sort) VALUES
 ('loc_e2e_depth1', ${q(E2E.depthEventId)}, 'ceremony', 'Depth Chapel', 'https://maps.app.goo.gl/depth1', '2027-10-09T17:00', 1),
 ('loc_e2e_over1', ${q(E2E.overtureEventId)}, 'ceremony', 'Overture Hall', 'https://maps.app.goo.gl/over1', '2027-11-20T18:00', 1);`,
	`INSERT INTO invitations (id, event_id, token, guest_label, max_seats, phone, lang, group_tag, revoked, created_at) VALUES
 ('inv_e2e_depth', ${q(E2E.depthEventId)}, ${q(E2E.tokens.depth)}, 'Rami & Lea', 2, NULL, 'en', NULL, 0, ${q(now)}),
 ('inv_e2e_over', ${q(E2E.overtureEventId)}, ${q(E2E.tokens.overture)}, 'Ziad', 1, NULL, 'en', NULL, 0, ${q(now)});`,
```

- [ ] **Step 3: Write the e2e specs**

Append to `tests/e2e/templates.spec.ts`:

```ts
test.describe('depth template (parallax story)', () => {
	test('cover opens into a continuous parallax scroll and takes an RSVP', async ({ page }) => {
		await page.goto(`/e/${E2E.depthSlug}/i/${E2E.tokens.depth}`);

		await expect(page.getByText('For Rami & Lea')).toBeVisible();
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// signature: a fixed photo plane behind the column, plus photo bands
		await expect(page.locator('.photo-plane')).toBeAttached();
		await expect(page.locator('.band').first()).toBeAttached();
		await expect(page.getByText('Scroll gently — the day unfolds as you go.')).toBeVisible();

		// the engine is driving: --p is set on the photo plane once scrolled
		await page.mouse.wheel(0, 1200);
		await expect
			.poll(async () =>
				page.locator('.photo-plane').evaluate((el) => el.style.getPropertyValue('--p'))
			)
			.not.toBe('');

		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		const changeAnswer = page.getByRole('button', { name: 'You can change your answer' });
		if (await changeAnswer.isVisible().catch(() => false)) await changeAnswer.click();
		await page.getByText('Yes, with joy').click();
		await page.locator('input[name="seats"]').fill('2');
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText("Wonderful! We can't wait to see you.")).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.depth}`);
		expect(await state.json()).toMatchObject({ rsvp: { attending: true, confirmedSeats: 2 } });
	});
});

test.describe('overture template (the envelope)', () => {
	test('the sealed envelope gates the story, then scrubs open', async ({ page }) => {
		await page.goto(`/e/${E2E.overtureSlug}/i/${E2E.tokens.overture}`);

		// sealed: the envelope is present and the stage is locked to one screen
		await expect(page.locator('.stage.sealed')).toBeVisible();
		await expect(page.locator('.env .flap')).toBeAttached();
		await expect(page.getByText('For Ziad')).toBeVisible();

		await page.getByRole('button', { name: 'Open Invitation' }).click();
		await expect(page.locator('.stage.sealed')).toHaveCount(0);

		// scrubbing advances the overture, then the parallax body follows
		await page.mouse.wheel(0, 2000);
		await expect(page.getByText('The envelope is yours to open.')).toBeVisible();
		await expect(page.getByText('70 987 654')).toBeAttached();

		await page.locator('[data-section="rsvp"]').scrollIntoViewIfNeeded();
		const changeAnswer = page.getByRole('button', { name: 'You can change your answer' });
		if (await changeAnswer.isVisible().catch(() => false)) await changeAnswer.click();
		await page.getByText('Yes, with joy').click();
		await page.getByRole('button', { name: 'Send answer' }).click();
		await expect(page.getByText("Wonderful! We can't wait to see you.")).toBeVisible();

		const state = await page.request.get(`/api/rsvp/${E2E.tokens.overture}`);
		expect(await state.json()).toMatchObject({ rsvp: { attending: true } });
	});
});

test.describe('scroll templates degrade safely', () => {
	test.use({ reducedMotion: 'reduce' });

	test('reduced-motion guests see every section already settled', async ({ page }) => {
		await page.goto(`/e/${E2E.depthSlug}/i/${E2E.tokens.depth}`);
		await page.getByRole('button', { name: 'Open Invitation' }).click();

		// the engine never registers, so --p stays unset and var(--p, X) rests
		await expect(page.locator('.photo-plane')).toHaveJSProperty('style.cssText', '');
		const hero = page.getByText('Scroll gently — the day unfolds as you go.');
		await hero.scrollIntoViewIfNeeded();
		await expect(hero).toBeVisible();
	});
});

test.describe('scroll templates without JavaScript', () => {
	test.use({ javaScriptEnabled: false });

	test('depth renders its full content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.depthSlug}/i/${E2E.tokens.depth}`);
		await expect(page.getByText('Scroll gently — the day unfolds as you go.')).toBeVisible();
		await expect(page.locator('[data-section="rsvp"]')).toBeAttached();
	});

	test('overture renders its card content with no script', async ({ page }) => {
		await page.goto(`/e/${E2E.overtureSlug}/i/${E2E.tokens.overture}`);
		await expect(page.getByText('Olivia & Victor').first()).toBeVisible();
		await expect(page.getByText('The envelope is yours to open.')).toBeAttached();
	});
});
```

- [ ] **Step 4: Run the e2e suite**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run test:e2e -- tests/e2e/templates.spec.ts
```

Expected: PASS on both `chromium` and `mobile-safari` projects.

Note on the no-JS cases: `depth.locked` sets `overflow: hidden` on a `100svh` box, so without JS the cover would trap the content. If the no-JS specs fail on visibility, that is a real defect — fix it by scoping the lock to a hydrated marker rather than by weakening the test. The minimal fix is to apply `.locked` only when JS has mounted: add `let mounted = $state(false); onMount(() => (mounted = true));` in `depth/Template.svelte` and change the class to `class:locked={mounted && !opened}`. Apply the same treatment to `.stage.sealed` in `Envelope.svelte` if the overture no-JS spec fails.

- [ ] **Step 5: Commit**

```bash
git add tests/seed/fixtures-e2e.ts tests/seed/seed-e2e.ts tests/e2e/templates.spec.ts \
  src/lib/templates/depth/Template.svelte src/lib/templates/shared/Envelope.svelte
git commit -m "test(templates): e2e coverage for depth and overture

Signature elements plus an RSVP round-trip per module, and the two
degradation paths the design turns on: a reduced-motion context
asserting --p is never written, and a javaScriptEnabled:false context
asserting both layouts render their content unaided."
```

---

### Task 7: Documentation and full verification

**Files:**

- Modify: `docs/templates.md`

- [ ] **Step 1: Extend the shipped-modules table**

In `docs/templates.md`, add these two rows to the table under "Shipped modules":

```markdown
| `depth` | Depth — Parallax Story | continuous scroll, fixed photo plane at 0.3x, sections settle in and recede, photo bands between |
| `overture` | Overture — The Envelope | `depth` preceded by a scroll-scrubbed envelope open; CSS 3D by default, three.js when available |
```

- [ ] **Step 2: Document the engine**

Add this section to `docs/templates.md`, immediately before "## Adding a new module":

```markdown
## The scroll-progress engine (2026-08-02)

Design spec: `docs/superpowers/specs/2026-08-02-scroll-driven-templates-design.md`.

`src/lib/actions/scroll-progress.ts` exposes `use:progress`, which writes a
normalized `--p` (0→1) onto its element from one shared rAF loop. Two modes:
`view` (default — 0 as the top edge meets the viewport bottom, 1 as the bottom
edge meets the viewport top) and `page` (whole-document scroll).

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
gzipped. Never import it eagerly. Its geometry is procedural because the CSP
(`default-src 'self'`, no `worker-src`) blocks DRACO's blob worker.
```

- [ ] **Step 3: Run the full verification suite**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run format
npm run lint
npm run check
npm run build
npm run test:unit -- --run
npm run test:e2e
```

Expected: all green. Record the actual gzipped size the bundle test reports for the three.js chunk — it belongs in the commit message.

- [ ] **Step 4: Verify all five templates still render**

```bash
export PATH="$HOME/.nvm/versions/node/v22.23.1/bin:$PATH"
npm run dev
```

Visit each and confirm no regression, particularly that the three pre-existing layouts are untouched:

- `http://localhost:5173/e/e2e-wedding/preview?template=slides`
- `http://localhost:5173/e/e2e-wedding/preview?template=edges`
- `http://localhost:5173/e/e2e-wedding/preview?template=cinematic`
- `http://localhost:5173/e/e2e-wedding/preview?template=depth`
- `http://localhost:5173/e/e2e-wedding/preview?template=overture`

Then open Studio → an event → Theme → Layout and confirm all five appear in the picker with their names and taglines.

- [ ] **Step 5: Commit**

```bash
git add docs/templates.md
git commit -m "docs: document the scroll-progress engine and the two new layouts

Records the var(--p, X) authoring rule that makes no-JS and
reduced-motion free, the ScrollBody reveal-neutralization, and the
hard constraint that three.js stays in overture's async chunk."
```

---

## Self-Review

**Spec coverage:**

| Spec section                                                   | Task                                |
| -------------------------------------------------------------- | ----------------------------------- |
| §2 Architecture (file layout)                                  | 1, 2, 4, 5                          |
| §3.1 Why JS not `animation-timeline`                           | 1 (implementation), 7 (documented)  |
| §3.2 Contract                                                  | 1                                   |
| §3.3 Performance rules                                         | 1                                   |
| §3.4 Progressive enhancement                                   | 1, 6 (no-JS + reduced-motion specs) |
| §4.1 Photo plane                                               | 2                                   |
| §4.2 Content sections, `rsvp`/`gifts` hold                     | 2                                   |
| §4.3 Signature moments (ring, engraved date, bands, countdown) | 2 (bands), 3 (ring, date)           |
| §4.4 The envelope                                              | 4                                   |
| §5.1 Procedural geometry                                       | 5                                   |
| §5.2 Gating                                                    | 5                                   |
| §5.3 Handoff, chunk-404 catch                                  | 5                                   |
| §5.4 Disposal                                                  | 5                                   |
| §6 Fallback matrix                                             | 4, 5, 6                             |
| §7 Budget                                                      | 5                                   |
| §8 Testing                                                     | 1, 2, 5, 6                          |
| §9 Integration                                                 | 2, 4, 7 (step 4)                    |

Gap found and closed: §4.3 item 4 ("Countdown roll") has no dedicated
choreography beyond the generic `.plane-inner` enter/recede that Task 2 gives
every section. That is intentional and sufficient — the countdown digits ride
the plane transform — so no extra task is needed. Recorded here so a reviewer
does not read it as an omission.

**Placeholder scan:** no TBD/TODO, no "add error handling", no "similar to Task N". Every code step carries complete code.

**Type consistency:** `computeProgress` / `pageProgress` / `progress` / `ProgressMode` (Task 1) are used verbatim in Tasks 2–4. `mountEnvelope` / `EnvelopeScene` / `setProgress` / `dispose` (Task 5) match between the module and its consumer. `ScrollBody`'s prop list `{ data, ctx, currentRsvp, errorKey, preview }` is identical in Tasks 2 and 4. `Envelope`'s prop list is identical between Task 4's definition and Task 5's rewrite.
