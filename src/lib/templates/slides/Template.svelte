<script lang="ts">
	import Cover from '$lib/components/sections/Cover.svelte';
	import Hero from '$lib/components/sections/Hero.svelte';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import Icon from '$lib/components/sections/Icon.svelte';
	import GiftAccount from '$lib/components/sections/GiftAccount.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import Closing from '$lib/components/sections/Closing.svelte';
	import Slideshow from '$lib/templates/shared/Slideshow.svelte';
	import { t } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';

	// Template "slides" — the signature deck: a Ken Burns photo wall breathing
	// behind every slide, monochrome ivory type over the scrim, nothing framing
	// the photography. Cover → gesture-unlocked music → scroll-snap
	// full-viewport slides (spec §3.1).
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	const slides = $derived(
		data.theme.slideOrder.filter((section) => {
			if (section === 'locations') return data.locations.length > 0;
			if (section === 'schedule') return data.event.datesExtra.length > 0;
			if (section === 'gifts') return Boolean(ctx.giftsText) || Boolean(data.theme.giftsAccount);
			return true;
		})
	);
</script>

<div class="deck">
	<Slideshow images={ctx.imageUrls} videoUrl={ctx.videoUrl} scrim={0.5} />

	<div class="scroller" class:locked={!opened}>
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
				{#if opened && index < slides.length - 1}
					<div class="cue" aria-hidden="true"><span></span></div>
				{/if}
			</section>
		{/each}
	</div>
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

	/* Clean full-bleed slides — the photography carries the page, nothing frames it. */
	.scroller :global(.slide) {
		position: relative;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 3.2rem 1.7rem;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	/* the RSVP card floats on frosted glass so the form stays legible on any photo */
	.glass {
		width: min(28rem, 100%);
		max-height: calc(100dvh - 6.5rem);
		overflow-y: auto;
		scrollbar-width: none;
		background: rgba(18, 14, 10, 0.55);
		backdrop-filter: blur(14px);
		-webkit-backdrop-filter: blur(14px);
		border: 1px solid rgba(250, 246, 238, 0.22);
		padding: 2.2rem 1.5rem;
		display: grid;
		place-items: center;
	}

	.glass::-webkit-scrollbar {
		display: none;
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

	/* the lightest possible scroll guide: a hairline that drips downward */
	.cue {
		position: absolute;
		inset-block-end: 1.3rem;
		inset-inline: 0;
		display: flex;
		justify-content: center;
		pointer-events: none;
	}

	.cue span {
		width: 1px;
		height: 34px;
		background: linear-gradient(to bottom, transparent, rgba(250, 246, 238, 0.85));
		transform-origin: top;
		animation: drip 2.4s ease-in-out infinite;
	}

	@keyframes drip {
		0% {
			transform: scaleY(0);
			opacity: 0;
		}
		45% {
			transform: scaleY(1);
			opacity: 0.9;
		}
		75%,
		100% {
			transform: scaleY(1);
			opacity: 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.cue span {
			animation: none;
			opacity: 0.5;
		}
	}
</style>
