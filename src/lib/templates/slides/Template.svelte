<script lang="ts">
	import Cover from '$lib/components/sections/Cover.svelte';
	import Hero from '$lib/components/sections/Hero.svelte';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import Closing from '$lib/components/sections/Closing.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "slides" — the original envelope experience (spec §3.1):
	// cover → gesture-unlocked music → scroll-snap full-viewport slides.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	const slides = $derived(
		data.theme.slideOrder.filter((section) => {
			if (section === 'locations') return data.locations.length > 0;
			if (section === 'schedule') return data.event.datesExtra.length > 0;
			return true;
		})
	);
</script>

<div class="scroller" class:locked={!opened}>
	<Cover
		title={ctx.title}
		dateText={ctx.dateFull}
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
			{:else if section === 'rsvp'}
				<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
			{:else if section === 'closing'}
				<Closing text={ctx.closingText} monogram={ctx.monogram} />
			{/if}
			{#if index === 0 && opened}
				<div class="more" aria-hidden="true">⌄</div>
			{/if}
		</section>
	{/each}
</div>

<style>
	.scroller {
		height: 100dvh;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		overscroll-behavior-y: contain;
	}

	.scroller.locked {
		overflow: hidden;
	}

	/* Every slide carries the card frame — this template's recurring signature. */
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
		border: 1px solid color-mix(in srgb, var(--ei-accent) 55%, transparent);
		pointer-events: none;
	}

	.scroller :global(.slide)::after {
		content: '';
		position: absolute;
		inset: 17px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 22%, transparent);
		pointer-events: none;
	}

	.more {
		position: absolute;
		inset-block-end: 1.9rem;
		inset-inline: 0;
		text-align: center;
		color: var(--ei-accent);
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
