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
		preview,
		ownsSlideAnchor = true
	}: {
		data: InviteData;
		ctx: TemplateCtx;
		currentRsvp: RsvpView;
		errorKey: string | null;
		preview: boolean;
		// Whether this ScrollBody instance puts the dispatcher's `id="slide-0"`
		// post-open scroll target (docs/templates.md module contract) on its own
		// `.overture-block` — the ring-draw/engraved-date signature moment that
		// opens every ScrollBody, `depth` included. Defaults to true — the
		// original, still-correct behavior for every template that has nothing
		// between the open gesture and this shell. Putting the id on
		// `sections[0]` instead (what this used to do) carried the guest straight
		// past that whole block to the first ordinary section — the same
		// skipped-signature-moment bug `overture` hit and fixed by moving the
		// anchor off this component entirely. `overture` passes false: its
		// 200svh envelope stage sits between the tap and ScrollBody, so
		// anchoring here would make the dispatcher's smooth-scroll sweep
		// straight through the whole envelope instead of leaving the guest at
		// its top to scrub it. `overture` puts `id="slide-0"` on the envelope
		// stage instead (see Envelope.svelte), so exactly one element still
		// carries the id.
		ownsSlideAnchor?: boolean;
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
		<div class="overture-block" id={ownsSlideAnchor ? 'slide-0' : undefined} use:progress>
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

		{#each sections as section, index (section)}
			<section class="plane" class:hold={holds(section)} data-section={section} use:progress>
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
	   inherited reveal rather than editing every section component. Scoped
	   to .plane-inner (the wrapper every section's content sits in, and the
	   only place .reveal ever appears here) rather than .scroll-body, so the
	   three-class selector outweighs InvitationPage's two-class
	   `.invite :global(.reveal)` — a bare `.scroll-body :global(.reveal)`
	   ties on specificity and loses to it on source order. */
	.scroll-body .plane-inner :global(.reveal) {
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

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .gift-heading,
	:global([dir='rtl']) .rule-line .caps {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
