<script lang="ts">
	import { onMount } from 'svelte';
	import { inview } from '$lib/actions/inview';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import Icon from '$lib/components/sections/Icon.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "cinematic" — the editorial: a names-and-hairline curtain while
	// the photography preloads, a full-bleed breathing hero, then quiet panels
	// separated by gold hairlines.
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
		<p class="loading-names">{ctx.title}</p>
		<div class="meter"><span style="width:{progress}%"></span></div>
		<p class="pct">{progress}%</p>
	</div>
{/if}

<div class="film" class:locked={!opened}>
	<header class="hero">
		{#if hero}
			<div class="hero-photo" style="background-image:url('{hero}')"></div>
		{/if}
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
			<span class="badge"><Icon name="gift" /></span>
			<h2 class="panel-heading">{t(ctx.lang, 'gifts.title')}</h2>
			<p class="gifts">{ctx.giftsText}</p>
		</section>
	{/if}

	<section class="panel" data-section="rsvp" use:inview>
		<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
	</section>

	<footer class="outro" use:inview>
		<p class="mono" aria-hidden="true"><span>{ctx.monogram}</span></p>
		<p class="closing">{ctx.closingText}</p>
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
		justify-items: center;
		gap: 1.3rem;
		background: var(--ei-text);
		color: var(--ei-bg);
		text-align: center;
		padding: 0 2rem;
	}

	.loading-names {
		margin: 0;
		font-family: var(--ei-font-script);
		font-size: clamp(2.2rem, 9vw, 3.2rem);
		line-height: 1.3;
	}

	.meter {
		width: min(16rem, 60vw);
		height: 1px;
		background: color-mix(in srgb, var(--ei-bg) 25%, transparent);
	}

	.meter span {
		display: block;
		height: 100%;
		background: var(--ei-accent);
		transition: width 0.3s ease;
	}

	.pct {
		margin: 0;
		font-family: var(--ei-font-caps);
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		opacity: 0.7;
	}

	:global([dir='rtl']) .pct {
		letter-spacing: 0;
		text-indent: 0;
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
		background-color: var(--ei-text);
		overflow: hidden;
	}

	.hero-photo {
		position: absolute;
		inset: 0;
		background-size: cover;
		background-position: center;
		animation: breathe 16s ease-in-out infinite alternate;
	}

	@keyframes breathe {
		from {
			transform: scale(1);
		}
		to {
			transform: scale(1.07);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hero-photo {
			animation: none;
		}
	}

	.veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(to top, rgba(8, 6, 5, 0.76), rgba(8, 6, 5, 0.08) 55%);
	}

	.hero-inner {
		position: relative;
		text-align: center;
		color: #fdfbf8;
		padding: 0 1.5rem 4.6rem;
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
		margin: 0 0 0.9rem;
		font-family: var(--ei-font-caps);
		font-size: 0.74rem;
		letter-spacing: 0.32em;
		text-indent: 0.32em;
		text-transform: uppercase;
		opacity: 0.85;
	}

	:global([dir='rtl']) .eyebrow {
		letter-spacing: 0;
		text-indent: 0;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 300;
		font-size: clamp(2.9rem, 11.5vw, 5rem);
		line-height: 1.08;
		text-wrap: balance;
	}

	.greeting {
		margin: 1.1rem 0 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.2rem;
	}

	.enter {
		margin-top: 1.9rem;
		font-family: var(--ei-font-body);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: #fdfbf8;
		background: transparent;
		border: 1px solid rgba(253, 251, 248, 0.75);
		border-radius: 999px;
		padding: 1rem 2.6rem;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	:global([dir='rtl']) .enter {
		letter-spacing: 0;
		text-indent: 0;
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
		padding: 5rem 1.9rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
		text-align: center;
	}

	.panel + .panel {
		position: relative;
	}

	.panel + .panel::before {
		content: '';
		position: absolute;
		top: 0;
		inset-inline: 32%;
		height: 1px;
		background: linear-gradient(
			to right,
			transparent,
			color-mix(in srgb, var(--ei-accent) 45%, transparent),
			transparent
		);
	}

	.verse {
		margin: 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.3rem;
		color: var(--ei-text);
		line-height: 1.9;
	}

	.welcome {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.1rem;
		line-height: 1.8;
	}

	.parents {
		margin: 0;
		font-family: var(--ei-font-body);
		font-size: 0.86rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--ei-muted);
		line-height: 2.1;
		white-space: pre-line;
	}

	:global([dir='rtl']) .parents {
		letter-spacing: 0;
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

	.panel-heading {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	:global([dir='rtl']) .panel-heading {
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
		border-radius: 2px;
		box-shadow: 0 24px 70px rgba(15, 11, 8, 0.38);
	}

	/* ── outro ───────────────────────────────────────── */
	.outro {
		padding: 4.5rem 1.5rem 3rem;
		text-align: center;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
	}

	.mono {
		margin: 0;
		width: 4rem;
		height: 4rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 70%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		color: var(--ei-accent);
	}

	.mono span {
		display: grid;
		place-items: center;
		width: 3.3rem;
		height: 3.3rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 35%, transparent);
		border-radius: 999px;
	}

	.closing {
		margin: 0;
		font-family: var(--ei-font-script);
		font-size: clamp(1.7rem, 6vw, 2.2rem);
		line-height: 1.5;
	}

	.colophon {
		margin: 1.5rem 0 0;
		font-family: var(--ei-font-body);
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ei-muted) 65%, transparent);
	}
</style>
