<script lang="ts">
	import Cover from '$lib/components/sections/Cover.svelte';
	import Hero from '$lib/components/sections/Hero.svelte';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import Icon from '$lib/components/sections/Icon.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import Closing from '$lib/components/sections/Closing.svelte';
	import Slideshow from '$lib/templates/shared/Slideshow.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "slides" — the signature deck: a Ken Burns photo wall breathing
	// behind every slide, monochrome ivory type over the scrim, hairline frames,
	// a dot rail for orientation. Cover → gesture-unlocked music → scroll-snap
	// full-viewport slides (spec §3.1).
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	const slides = $derived(
		data.theme.slideOrder.filter((section) => {
			if (section === 'locations') return data.locations.length > 0;
			if (section === 'schedule') return data.event.datesExtra.length > 0;
			if (section === 'gifts') return Boolean(ctx.giftsText);
			return true;
		})
	);

	let scroller: HTMLDivElement | undefined = $state();
	let active = $state(0);

	// Dot rail follows the visible slide (cover = dot 0).
	$effect(() => {
		void slides;
		if (!scroller) return;
		const els = [...scroller.querySelectorAll('.slide')];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) active = els.indexOf(entry.target);
				}
			},
			{ root: scroller, threshold: 0.55 }
		);
		for (const el of els) observer.observe(el);
		return () => observer.disconnect();
	});

	function goTo(index: number) {
		scroller?.querySelectorAll('.slide')[index]?.scrollIntoView({ behavior: 'smooth' });
	}
</script>

<div class="deck">
	<Slideshow images={ctx.imageUrls} scrim={0.5} />

	<div class="scroller" class:locked={!opened} bind:this={scroller}>
		<Cover
			title={ctx.title}
			dateParts={ctx.dateParts}
			greeting={t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}
			openLabel={t(ctx.lang, 'cover.open')}
			monogram={ctx.monogram}
			{opened}
			{onopen}
		/>

		{#each slides as section, index (section)}
			<section class="slide" id="slide-{index}" data-section={section}>
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
						<p class="gift-text">{ctx.giftsText}</p>
					</div>
				{:else if section === 'rsvp'}
					<div class="glass">
						<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
					</div>
				{:else if section === 'closing'}
					<Closing text={ctx.closingText} monogram={ctx.monogram} />
				{/if}
				{#if index === 0 && opened}
					<div class="more" aria-hidden="true">⌄</div>
				{/if}
			</section>
		{/each}
	</div>

	{#if opened && !preview}
		<nav class="dots" aria-label="Sections">
			{#each ['cover', ...slides] as section, index (section)}
				<button
					type="button"
					class:on={active === index}
					onclick={() => goTo(index)}
					aria-label={section}
					aria-current={active === index}
				></button>
			{/each}
		</nav>
	{/if}
</div>

<style>
	/* Photography is the palette: the deck speaks monochrome ivory over the
	   photo wall, whatever the page theme is (the dispatcher re-scopes the
	   surface vars); only --ei-accent carries through. */
	.deck {
		position: relative;
		height: 100dvh;
		overflow: hidden;
		color: var(--ei-text);
	}

	.scroller {
		position: relative;
		z-index: 3;
		height: 100dvh;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		overscroll-behavior-y: contain;
	}

	.scroller.locked {
		overflow: hidden;
	}

	/* Every slide carries the hairline frame — this template's recurring signature. */
	.scroller :global(.slide) {
		position: relative;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 3.2rem 1.7rem;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	.scroller :global(.slide)::before {
		content: '';
		position: absolute;
		inset: 12px;
		border: 1px solid rgba(250, 246, 238, 0.32);
		pointer-events: none;
	}

	.scroller :global(.slide)::after {
		content: '';
		position: absolute;
		inset: 17px;
		border: 1px solid rgba(250, 246, 238, 0.14);
		pointer-events: none;
	}

	/* the RSVP card floats on frosted glass so the form stays legible on any photo */
	.glass {
		width: min(28rem, 100%);
		max-height: calc(100dvh - 6.5rem);
		overflow-y: auto;
		background: rgba(18, 14, 10, 0.55);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid rgba(250, 246, 238, 0.22);
		padding: 2.2rem 1.5rem;
		display: grid;
		place-items: center;
	}

	.gifts {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		max-width: 30rem;
	}

	.gift-badge {
		display: grid;
		place-items: center;
		width: 3.6rem;
		height: 3.6rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 55%, transparent);
		border-radius: 999px;
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
		font-size: 1.25rem;
		line-height: 1.85;
		white-space: pre-line;
	}

	:global([dir='rtl']) .gift-heading {
		letter-spacing: 0;
		text-indent: 0;
	}

	/* dot rail — orientation without chrome */
	.dots {
		position: absolute;
		z-index: 10;
		inset-inline-end: 0.55rem;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.4rem;
	}

	.dots button {
		width: 0.42rem;
		height: 0.42rem;
		padding: 0;
		border: none;
		border-radius: 999px;
		background: rgba(250, 246, 238, 0.38);
		cursor: pointer;
		transition:
			transform 0.3s ease,
			background-color 0.3s ease;
	}

	.dots button.on {
		background: var(--ei-accent);
		transform: scale(1.5);
	}

	.dots button:focus-visible {
		outline: 2px solid rgba(250, 246, 238, 0.8);
		outline-offset: 2px;
	}

	.more {
		position: absolute;
		inset-block-end: 1.9rem;
		inset-inline: 0;
		text-align: center;
		color: rgba(250, 246, 238, 0.85);
		font-size: 1.3rem;
		animation: drift 2.4s ease-in-out infinite;
	}

	@media (prefers-reduced-motion: reduce) {
		.more {
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
</style>
