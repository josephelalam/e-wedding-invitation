<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import Petals from '$lib/templates/shared/Petals.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "edges" — a long scrolling story: full-bleed photos torn like
	// paper between quiet cards. Photos are owner-placed R2 keys (hard
	// constraint #1: no upload UI); with no photos the bands become soft
	// gradients so the template never breaks.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	const bands = $derived(ctx.imageUrls);
	const band = (index: number): string | null => bands[index % Math.max(bands.length, 1)] ?? null;
	const endPhoto = $derived(bands.length > 0 ? bands[bands.length - 1] : null);
</script>

<Petals color={data.theme.colors.accent} />

<div class="story" class:locked={!opened}>
	<header class="hero" style={band(0) ? `background-image:url('${band(0)}')` : ''}>
		<div class="hero-veil"></div>
		<div class="hero-content">
			<p class="greeting">{t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}</p>
			<h1 class="names">{ctx.title}</h1>
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

	{#if data.locations.length > 0}
		{#if band(2)}
			<div class="band" style="background-image:url('{band(2)}')"></div>
		{:else}
			<div class="band fallback"></div>
		{/if}
		<article class="card" use:inview>
			<Locations locations={data.locations} lang={ctx.lang} />
		</article>
	{/if}

	{#if data.event.datesExtra.length > 0}
		<article class="card" use:inview>
			<Schedule datesExtra={data.event.datesExtra} lang={ctx.lang} />
		</article>
	{/if}

	{#if ctx.giftsText}
		<article class="card" use:inview>
			<h2 class="card-heading">{t(ctx.lang, 'gifts.title')}</h2>
			<p class="gifts">{ctx.giftsText}</p>
		</article>
	{/if}

	{#if band(3)}
		<div class="band" style="background-image:url('{band(3)}')"></div>
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

	.hero-veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to bottom,
			rgba(20, 16, 12, 0.35),
			rgba(20, 16, 12, 0.15) 40%,
			rgba(20, 16, 12, 0.55)
		);
	}

	.hero-content {
		position: relative;
		color: #fdfbf8;
		padding: 2rem 1.5rem;
		text-shadow: 0 1px 14px rgba(0, 0, 0, 0.45);
	}

	.greeting {
		margin: 0 0 1rem;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.2rem;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 500;
		font-size: clamp(2.6rem, 10vw, 4rem);
		line-height: 1.12;
		text-wrap: balance;
	}

	.date {
		margin: 1rem 0 0;
		letter-spacing: 0.16em;
		font-size: 0.95rem;
	}

	:global([dir='rtl']) .date {
		letter-spacing: 0;
	}

	.open {
		margin-top: 2rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--ei-text);
		background: #fdfbf8;
		border: none;
		border-radius: 999px;
		padding: 0.95rem 2.4rem;
		cursor: pointer;
	}

	:global([dir='rtl']) .open {
		letter-spacing: 0;
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
		padding: 4rem 1.9rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		text-align: center;
	}

	.verse {
		margin: 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.05rem;
		color: var(--ei-muted);
		line-height: 1.9;
	}

	.parents {
		margin: 0;
		font-size: 0.92rem;
		letter-spacing: 0.06em;
		color: var(--ei-muted);
		line-height: 1.9;
		white-space: pre-line;
	}

	.welcome {
		margin: 0;
		font-size: 1.05rem;
	}

	.card-names {
		margin: 0.4rem 0 0;
		font-family: var(--ei-font-display);
		font-weight: 500;
		font-size: clamp(2rem, 8vw, 2.9rem);
		color: var(--ei-accent);
		text-wrap: balance;
	}

	.card-date {
		margin: 0;
		letter-spacing: 0.14em;
		color: var(--ei-muted);
		font-size: 0.92rem;
	}

	:global([dir='rtl']) .card-date {
		letter-spacing: 0;
	}

	.card-heading {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	:global([dir='rtl']) .card-heading {
		letter-spacing: 0;
	}

	.gifts {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.2rem;
		line-height: 1.8;
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
		padding: 4rem 1.5rem 3rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
	}

	.polaroid {
		margin: 0;
		background: #fff;
		padding: 0.8rem 0.8rem 1.1rem;
		box-shadow: 0 14px 42px rgba(30, 22, 16, 0.22);
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
		margin-top: 0.9rem;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.05rem;
		color: var(--ei-text);
	}

	.end-caption {
		margin: 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.35rem;
	}

	.colophon {
		margin: 2rem 0 0;
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ei-muted) 65%, transparent);
	}

	/* entrance reveal (shared .reveal classes come from the dispatcher) */
</style>
