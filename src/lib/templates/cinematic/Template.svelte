<script lang="ts">
	import { onMount } from 'svelte';
	import { inview } from '$lib/actions/inview';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "cinematic" — a percentage curtain while the photography
	// preloads, then a full-bleed hero and sections that fade in on scroll.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	let progress = $state(0);
	let ready = $state(false);

	onMount(() => {
		const urls = ctx.imageUrls;
		if (urls.length === 0) {
			progress = 100;
			ready = true;
			return;
		}
		let loaded = 0;
		let finished = false;
		const done = () => {
			if (finished) return;
			finished = true;
			progress = 100;
			ready = true;
		};
		for (const url of urls) {
			const img = new Image();
			const step = () => {
				loaded += 1;
				progress = Math.round((loaded / urls.length) * 100);
				if (loaded >= urls.length) done();
			};
			img.onload = step;
			img.onerror = step;
			img.src = url;
		}
		// a slow 4G photo must never trap the guest behind the curtain
		const failSafe = setTimeout(done, 6000);
		return () => clearTimeout(failSafe);
	});

	const hero = $derived(ctx.imageUrls[0] ?? null);
	const mid = $derived(ctx.imageUrls[1] ?? ctx.imageUrls[0] ?? null);
</script>

{#if !ready}
	<div class="curtain" aria-hidden="true">
		<p class="pct">{progress}%</p>
		<p class="loading-names">{ctx.title}</p>
	</div>
{/if}

<div class="film" class:locked={!opened}>
	<header class="hero" style={hero ? `background-image:url('${hero}')` : ''}>
		<div class="veil"></div>
		<div class="hero-inner" class:shown={ready}>
			<p class="eyebrow">{ctx.dateFull}</p>
			<h1 class="names">{ctx.title}</h1>
			<p class="greeting">{t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}</p>
			{#if !opened}
				<button class="enter" type="button" onclick={onopen}>{t(ctx.lang, 'cover.open')}</button>
			{:else}
				<p class="swipe" aria-hidden="true">⌄</p>
			{/if}
		</div>
	</header>

	<section class="panel" id="slide-0" use:inview>
		{#if ctx.introText}<p class="verse">{ctx.introText}</p>{/if}
		{#if ctx.welcomeText}<p class="welcome">{ctx.welcomeText}</p>{/if}
		{#if ctx.parentsText}<p class="parents">{ctx.parentsText}</p>{/if}
	</section>

	<section class="panel" use:inview>
		<Countdown targetIso={data.event.dateMain} lang={ctx.lang} />
	</section>

	{#if mid}
		<div class="frame" use:inview>
			<img src={mid} alt="" loading="lazy" />
		</div>
	{/if}

	{#if data.locations.length > 0}
		<section class="panel" use:inview>
			<Locations locations={data.locations} lang={ctx.lang} />
		</section>
	{/if}

	{#if data.event.datesExtra.length > 0}
		<section class="panel" use:inview>
			<Schedule datesExtra={data.event.datesExtra} lang={ctx.lang} />
		</section>
	{/if}

	{#if ctx.giftsText}
		<section class="panel" use:inview>
			<h2 class="panel-heading">{t(ctx.lang, 'gifts.title')}</h2>
			<p class="gifts">{ctx.giftsText}</p>
		</section>
	{/if}

	<section class="panel" data-section="rsvp" use:inview>
		<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
	</section>

	<footer class="outro" use:inview>
		<p class="closing">{ctx.closingText}</p>
		<p class="mono">{ctx.monogram}</p>
		<p class="colophon">einvite</p>
	</footer>
</div>

<style>
	/* ── loading curtain ─────────────────────────────── */
	.curtain {
		position: fixed;
		inset: 0;
		z-index: 60;
		display: grid;
		place-content: center;
		gap: 0.6rem;
		background: var(--ei-text);
		color: var(--ei-bg);
		text-align: center;
	}

	.pct {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: clamp(3rem, 14vw, 5rem);
		font-variant-numeric: tabular-nums;
	}

	.loading-names {
		margin: 0;
		letter-spacing: 0.3em;
		text-transform: uppercase;
		font-size: 0.72rem;
		opacity: 0.7;
	}

	:global([dir='rtl']) .loading-names {
		letter-spacing: 0;
	}

	/* ── hero ────────────────────────────────────────── */
	.film {
		background: var(--ei-bg);
	}

	.film.locked {
		height: 100dvh;
		overflow: hidden;
	}

	.hero {
		position: relative;
		min-height: 100dvh;
		display: grid;
		place-items: end center;
		background-size: cover;
		background-position: center;
		background-color: var(--ei-text);
	}

	.veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(8, 6, 5, 0.72), rgba(8, 6, 5, 0.08) 55%);
	}

	.hero-inner {
		position: relative;
		text-align: center;
		color: #fdfbf8;
		padding: 0 1.5rem 4.4rem;
		opacity: 0;
		transform: translateY(18px);
		transition:
			opacity 1.1s ease 0.15s,
			transform 1.1s ease 0.15s;
	}

	.hero-inner.shown {
		opacity: 1;
		transform: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-inner {
			transition: none;
			opacity: 1;
			transform: none;
		}
	}

	.eyebrow {
		margin: 0 0 0.6rem;
		font-size: 0.78rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	:global([dir='rtl']) .eyebrow {
		letter-spacing: 0;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 500;
		font-size: clamp(2.8rem, 11vw, 4.6rem);
		line-height: 1.08;
		text-wrap: balance;
	}

	.greeting {
		margin: 1rem 0 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.15rem;
	}

	.enter {
		margin-top: 1.8rem;
		font: inherit;
		font-size: 0.82rem;
		font-weight: 600;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: #fdfbf8;
		background: transparent;
		border: 1px solid rgba(253, 251, 248, 0.75);
		border-radius: 999px;
		padding: 0.9rem 2.6rem;
		cursor: pointer;
	}

	:global([dir='rtl']) .enter {
		letter-spacing: 0;
	}

	.enter:hover {
		background: rgba(253, 251, 248, 0.14);
	}

	.enter:focus-visible {
		outline: 2px solid #fdfbf8;
		outline-offset: 3px;
	}

	.swipe {
		margin: 1.8rem 0 0;
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

	/* ── panels ──────────────────────────────────────── */
	.panel {
		max-width: 34rem;
		margin: 0 auto;
		padding: 4.6rem 1.9rem;
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

	.welcome {
		margin: 0;
		font-size: 1.05rem;
	}

	.parents {
		margin: 0;
		font-size: 0.92rem;
		color: var(--ei-muted);
		line-height: 1.9;
		white-space: pre-line;
	}

	.panel-heading {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	:global([dir='rtl']) .panel-heading {
		letter-spacing: 0;
	}

	.gifts {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.2rem;
		line-height: 1.8;
		white-space: pre-line;
	}

	/* ── letterboxed photo frame ─────────────────────── */
	.frame {
		max-width: 40rem;
		margin: 0 auto;
		padding: 0 1.2rem;
	}

	.frame img {
		display: block;
		width: 100%;
		aspect-ratio: 3 / 4;
		object-fit: cover;
		border-radius: 4px;
		box-shadow: 0 22px 60px rgba(15, 11, 8, 0.35);
	}

	/* ── outro ───────────────────────────────────────── */
	.outro {
		padding: 4rem 1.5rem 3rem;
		text-align: center;
	}

	.closing {
		margin: 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.35rem;
	}

	.mono {
		margin: 1.4rem 0 0;
		width: 3.1rem;
		height: 3.1rem;
		display: inline-grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 60%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		color: var(--ei-accent);
	}

	.colophon {
		margin: 2rem 0 0;
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ei-muted) 65%, transparent);
	}
</style>
