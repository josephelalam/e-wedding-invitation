<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Icon from '$lib/components/sections/Icon.svelte';
	import GiftAccount from '$lib/components/sections/GiftAccount.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "edges" — the formal story: full-bleed photos torn like paper
	// between quiet stationery cards, in the verse → families → couple → day
	// order the market's formal invitations follow. Photos come from owner-
	// placed R2 keys, else the bundled stock set (see templates/stock.ts).
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	const bands = $derived(ctx.imageUrls);
	const band = (index: number): string | null => bands[index % Math.max(bands.length, 1)] ?? null;
	const endPhoto = $derived(bands.length > 0 ? bands[bands.length - 1] : null);

	// A long list of stops crops badly into one card: the getting-ready houses
	// get their own card, a photo tears the page after the bride's house, then
	// the ceremony/celebration stops follow.
	const houses = $derived(
		data.locations.filter((l) => l.kind === 'house_groom' || l.kind === 'house_bride')
	);
	const dayStops = $derived(
		data.locations.filter((l) => l.kind !== 'house_groom' && l.kind !== 'house_bride')
	);
</script>

<div class="story" class:locked={!opened}>
	<header class="hero" style={band(0) ? `background-image:url('${band(0)}')` : ''}>
		<div class="hero-veil"></div>
		<div class="hero-content">
			<p class="greeting">{t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}</p>
			<h1 class="names">{ctx.title}</h1>
			<p class="hero-flourish" aria-hidden="true"><span></span>✦<span></span></p>
			<p class="date">{ctx.dateFull}</p>
			{#if !opened}
				<button class="open" type="button" onclick={onopen}>
					{t(ctx.lang, 'cover.open')}
				</button>
			{:else}
				<p class="swipe" aria-hidden="true">⌄</p>
			{/if}
		</div>
	</header>

	<article class="card" id="slide-0" use:inview>
		<p class="seal" aria-hidden="true"><span>{ctx.monogram}</span></p>
		{#if ctx.introText}<p class="verse">{ctx.introText}</p>{/if}
		{#if ctx.parentsText}<p class="parents">{ctx.parentsText}</p>{/if}
		{#if ctx.welcomeText}<p class="welcome">{ctx.welcomeText}</p>{/if}
		<h2 class="card-names">{ctx.title}</h2>
		<p class="card-date">{ctx.dateFull}</p>
	</article>

	{#if band(1)}
		<div class="band" style="background-image:url('{band(1)}')"></div>
	{:else}
		<div class="band fallback"></div>
	{/if}

	<article class="card" use:inview>
		<Countdown targetIso={data.event.dateMain} lang={ctx.lang} />
	</article>

	{#if houses.length > 0}
		{#if band(2)}
			<div class="band" style="background-image:url('{band(2)}')"></div>
		{:else}
			<div class="band fallback"></div>
		{/if}
		<article class="card page" use:inview>
			<Locations locations={houses} lang={ctx.lang} />
		</article>
	{/if}

	{#if dayStops.length > 0}
		{#if band(houses.length > 0 ? 3 : 2)}
			<div class="band" style="background-image:url('{band(houses.length > 0 ? 3 : 2)}')"></div>
		{:else}
			<div class="band fallback"></div>
		{/if}
		<article class="card page" use:inview>
			<Locations
				locations={dayStops}
				lang={ctx.lang}
				heading={houses.length > 0 ? null : undefined}
			/>
		</article>
	{/if}

	{#if ctx.giftsText || data.theme.giftsAccount}
		<article class="card" use:inview>
			<span class="badge"><Icon name="gift" /></span>
			<h2 class="card-heading">{t(ctx.lang, 'gifts.title')}</h2>
			{#if ctx.giftsText}<p class="gifts">{ctx.giftsText}</p>{/if}
			{#if data.theme.giftsAccount}
				<GiftAccount
					label={data.theme.giftsAccountLabel}
					account={data.theme.giftsAccount}
					lang={ctx.lang}
				/>
			{/if}
		</article>
	{/if}

	{#if band(4)}
		<div class="band" style="background-image:url('{band(4)}')"></div>
	{:else}
		<div class="band fallback"></div>
	{/if}

	<article class="card" data-section="rsvp" use:inview>
		<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
	</article>

	<footer class="end" use:inview>
		{#if endPhoto}
			<figure class="polaroid">
				<img src={endPhoto} alt="" loading="lazy" />
				<figcaption>{ctx.endCaptionText ?? ctx.closingText}</figcaption>
			</figure>
		{:else}
			<p class="end-caption">{ctx.endCaptionText ?? ctx.closingText}</p>
		{/if}
		<p class="colophon">einvite</p>
	</footer>
</div>

<noscript>
	<style>
		/* No-JS guests can never fire `onopen`, so the SSR-immediate `.story.locked`
		   lock above would trap them behind the cover forever — this is their only
		   way in. Unlike slides/cinematic, `.story`'s base rule sets no height or
		   overflow at all — `.locked` adds both `height: 100dvh` and
		   `overflow: hidden` itself, so both must be reset here.
		   `!important` is required: Svelte scopes `.story.locked` with its own hash
		   class (e.g. `.story.locked.svelte-abc123`), so a plain `.locked` rule
		   here would lose the specificity fight. */
		.story.locked {
			height: auto !important;
			overflow: visible !important;
		}
	</style>
</noscript>

<style>
	.story {
		background: var(--ei-bg);
	}

	.story.locked {
		height: 100dvh;
		overflow: hidden;
	}

	/* ── hero ─────────────────────────────────────────── */
	.hero {
		position: relative;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		background-size: cover;
		background-position: center;
		background-color: color-mix(in srgb, var(--ei-accent) 30%, var(--ei-text));
		text-align: center;
	}

	/* the page tears up into the hero photo as you begin to scroll —
	   the same paper rip the bands use, from the very first movement */
	.hero::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		bottom: -1px;
		height: 58px;
		background: var(--ei-bg);
		z-index: 2;
		mask: url('/templates/edges/edge-bottom.svg') center / 100% 100% no-repeat;
		-webkit-mask: url('/templates/edges/edge-bottom.svg') center / 100% 100% no-repeat;
	}

	.hero-veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(18, 14, 10, 0.42),
			rgba(18, 14, 10, 0.18) 42%,
			rgba(18, 14, 10, 0.6)
		);
	}

	.hero-content {
		position: relative;
		color: #fdfbf8;
		padding: 2rem 1.5rem;
		width: min(34rem, 100%);
		display: flex;
		flex-direction: column;
		align-items: center;
		text-shadow: 0 1px 18px rgba(0, 0, 0, 0.4);
	}

	.greeting {
		margin: 0 0 1.2rem;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.25rem;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(2.9rem, 12vw, 4.4rem);
		line-height: 1.25;
		text-wrap: balance;
	}

	.hero-flourish {
		margin: 1.1rem 0;
		width: min(17rem, 75%);
		display: flex;
		align-items: center;
		gap: 0.9rem;
		font-size: 0.65rem;
		opacity: 0.9;
	}

	.hero-flourish span {
		flex: 1;
		height: 1px;
		background: rgba(253, 251, 248, 0.45);
	}

	.date {
		margin: 0;
		font-family: var(--ei-font-caps);
		letter-spacing: 0.2em;
		text-indent: 0.2em;
		text-transform: uppercase;
		font-size: 0.9rem;
	}

	:global([dir='rtl']) .date {
		letter-spacing: 0;
		text-indent: 0;
	}

	.open {
		margin-top: 2.2rem;
		font-family: var(--ei-font-body);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: #fdfbf8;
		background: transparent;
		border: 1px solid rgba(253, 251, 248, 0.7);
		border-radius: 999px;
		padding: 1rem 2.6rem;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	:global([dir='rtl']) .open {
		letter-spacing: 0;
		text-indent: 0;
	}

	.open:hover {
		background: rgba(253, 251, 248, 0.14);
	}

	.open:focus-visible {
		outline: 2px solid #fdfbf8;
		outline-offset: 3px;
	}

	.swipe {
		margin: 2rem 0 0;
		font-size: 1.4rem;
		animation: drift 2.4s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.swipe {
			animation: none;
		}
	}

	@keyframes drift {
		0%,
		100% {
			transform: translateY(0);
			opacity: 0.55;
		}
		50% {
			transform: translateY(6px);
			opacity: 1;
		}
	}

	/* ── content cards ────────────────────────────────── */
	.card {
		position: relative;
		z-index: 2;
		max-width: 34rem;
		margin: 0 auto;
		padding: 4.6rem 1.9rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
		text-align: center;
	}

	/* the two location cards read as full pages — consistent scroll rhythm */
	.card.page {
		min-height: 100dvh;
		justify-content: center;
	}

	.seal {
		margin: 0 0 0.4rem;
		width: 4rem;
		height: 4rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 70%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		font-size: 1.05rem;
		color: var(--ei-accent);
	}

	.seal span {
		display: grid;
		place-items: center;
		width: 3.3rem;
		height: 3.3rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 35%, transparent);
		border-radius: 999px;
	}

	.verse {
		margin: 0;
		position: relative;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.18rem;
		color: var(--ei-muted);
		line-height: 1.95;
		max-width: 28rem;
		white-space: pre-line;
	}

	.verse::before {
		content: '“';
		display: block;
		font-family: var(--ei-font-display);
		font-size: 3rem;
		line-height: 0.4;
		margin-bottom: 0.5rem;
		color: color-mix(in srgb, var(--ei-accent) 70%, transparent);
	}

	:global([dir='rtl']) .verse::before {
		content: '”';
	}

	.parents {
		margin: 0;
		font-family: var(--ei-font-body);
		font-size: 0.86rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ei-text);
		line-height: 2.1;
		white-space: pre-line;
	}

	:global([dir='rtl']) .parents {
		letter-spacing: 0;
	}

	.welcome {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.12rem;
		line-height: 1.8;
	}

	.card-names {
		margin: 0.5rem 0 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(2.3rem, 9vw, 3.2rem);
		line-height: 1.3;
		color: var(--ei-accent);
		text-wrap: balance;
	}

	.card-date {
		margin: 0;
		font-family: var(--ei-font-caps);
		letter-spacing: 0.16em;
		text-indent: 0.16em;
		text-transform: uppercase;
		color: var(--ei-muted);
		font-size: 0.88rem;
	}

	:global([dir='rtl']) .card-date {
		letter-spacing: 0;
		text-indent: 0;
	}

	.badge {
		display: grid;
		place-items: center;
		width: 3.6rem;
		height: 3.6rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 45%, transparent);
		border-radius: 999px;
		color: var(--ei-accent);
	}

	.card-heading {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	:global([dir='rtl']) .card-heading {
		letter-spacing: 0;
		text-indent: 0;
	}

	.gifts {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.22rem;
		line-height: 1.9;
		white-space: pre-line;
	}

	/* ── torn photo bands ─────────────────────────────── */
	.band {
		position: relative;
		height: min(62vh, 34rem);
		background-size: cover;
		background-position: center;
	}

	.band.fallback {
		background: linear-gradient(
			160deg,
			color-mix(in srgb, var(--ei-accent) 45%, var(--ei-bg)),
			color-mix(in srgb, var(--ei-accent) 18%, var(--ei-bg))
		);
	}

	/* Paper tears: strips of the page background masked by the torn SVGs */
	.band::before,
	.band::after {
		content: '';
		position: absolute;
		inset-inline: 0;
		height: 58px;
		background: var(--ei-bg);
		z-index: 1;
	}

	.band::before {
		top: -1px;
		mask: url('/templates/edges/edge-top.svg') center / 100% 100% no-repeat;
		-webkit-mask: url('/templates/edges/edge-top.svg') center / 100% 100% no-repeat;
	}

	.band::after {
		bottom: -1px;
		mask: url('/templates/edges/edge-bottom.svg') center / 100% 100% no-repeat;
		-webkit-mask: url('/templates/edges/edge-bottom.svg') center / 100% 100% no-repeat;
	}

	/* ── ending ───────────────────────────────────────── */
	.end {
		padding: 4.5rem 1.5rem 3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
	}

	.polaroid {
		margin: 0;
		background: #fff;
		padding: 0.85rem 0.85rem 1.2rem;
		box-shadow: 0 18px 50px rgba(30, 22, 16, 0.28);
		transform: rotate(-2.2deg);
		max-width: 20rem;
	}

	.polaroid img {
		display: block;
		width: 100%;
		aspect-ratio: 4 / 5;
		object-fit: cover;
	}

	.polaroid figcaption {
		margin-top: 1rem;
		font-family: var(--ei-font-script);
		font-size: 1.35rem;
		color: #2c2620;
	}

	.end-caption {
		margin: 0;
		font-family: var(--ei-font-script);
		font-size: 1.8rem;
	}

	.colophon {
		margin: 2.2rem 0 0;
		font-family: var(--ei-font-body);
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ei-muted) 65%, transparent);
	}

	/* entrance reveal (shared .reveal classes come from the dispatcher) */
</style>
