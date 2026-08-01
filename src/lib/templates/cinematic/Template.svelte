<script lang="ts">
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import GiftAccount from '$lib/components/sections/GiftAccount.svelte';
	import Icon from '$lib/components/sections/Icon.svelte';
	import RsvpBlock from '$lib/templates/shared/RsvpBlock.svelte';
	import Slideshow from '$lib/templates/shared/Slideshow.svelte';
	import { t, type Lang } from '$lib/i18n';
	import type { TemplateProps } from '$lib/templates/types';
	import type { InviteLocation } from '$lib/types';

	// Template "cinematic" → the Horizon deck: the market's horizontal story
	// format (both premium references swipe sideways), built on native
	// scroll-snap so momentum swipe, keyboard arrows, RTL mirroring and no-JS
	// rendering all come free — where the references hand-roll transforms.
	// Ritual: blurred-photo cover gate → formal invitation → countdown ledger
	// → venue scenes → gifts → RSVP glass → tilted polaroid finale.
	let { data, ctx, currentRsvp, errorKey, preview, opened, onopen }: TemplateProps = $props();

	type Scene =
		| { key: string; kind: 'formal' | 'countdown' | 'gifts' | 'rsvp' | 'closing' }
		| { key: string; kind: 'locations'; pair: InviteLocation[] };

	const scenes: Scene[] = $derived.by(() => {
		// The getting-ready ritual gets its own scene: groom's and bride's
		// houses always lead, before the ceremony — whatever the stored sort.
		const houses = data.locations.filter(
			(location) => location.kind === 'house_groom' || location.kind === 'house_bride'
		);
		const day = data.locations.filter(
			(location) => location.kind !== 'house_groom' && location.kind !== 'house_bride'
		);
		const pairs: InviteLocation[][] = houses.length > 0 ? [houses] : [];
		for (let i = 0; i < day.length; i += 2) {
			pairs.push(day.slice(i, i + 2));
		}
		return [
			{ key: 'formal', kind: 'formal' as const },
			{ key: 'countdown', kind: 'countdown' as const },
			...pairs.map((pair, i) => ({ key: `locations-${i}`, kind: 'locations' as const, pair })),
			...(ctx.giftsText || data.theme.giftsAccount
				? [{ key: 'gifts', kind: 'gifts' as const }]
				: []),
			{ key: 'rsvp', kind: 'rsvp' as const },
			{ key: 'closing', kind: 'closing' as const }
		];
	});

	let track: HTMLDivElement | undefined = $state();
	let active = $state(0);

	$effect(() => {
		void scenes;
		if (!track) return;
		const els = [...track.querySelectorAll('.scene')];
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) active = els.indexOf(entry.target);
				}
			},
			{ root: track, threshold: 0.55 }
		);
		for (const el of els) observer.observe(el);
		return () => observer.disconnect();
	});

	function goTo(index: number) {
		const target =
			track?.querySelectorAll('.scene')[Math.max(0, Math.min(index, scenes.length - 1))];
		target?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
	}

	// Desktop mouse wheels don't scroll horizontal containers — one notch, one scene.
	let wheelLockUntil = 0;
	function onWheel(event: WheelEvent) {
		const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
		if (Math.abs(delta) < 8) return;
		event.preventDefault();
		const now = performance.now();
		if (now < wheelLockUntil) return;
		wheelLockUntil = now + 650;
		goTo(active + (delta > 0 ? 1 : -1));
	}

	function locationLabel(location: InviteLocation, lang: Lang): string {
		const byLang: Record<Lang, string | null> = {
			ar: location.labelAr,
			fr: location.labelFr,
			en: location.labelEn
		};
		return (
			byLang[lang] ??
			location.labelEn ??
			location.labelFr ??
			location.labelAr ??
			t(lang, `locations.kind.${location.kind}`)
		);
	}

	const timeFormat = $derived(
		new Intl.DateTimeFormat(ctx.lang === 'ar' ? 'ar-LB-u-nu-latn' : ctx.lang, {
			hour: 'numeric',
			minute: '2-digit'
		})
	);

	const closingPhoto = $derived(
		ctx.imageUrls.length > 0 ? ctx.imageUrls[ctx.imageUrls.length - 1] : null
	);
</script>

<div class="stage">
	<Slideshow images={ctx.imageUrls} videoUrl={ctx.videoUrl} scrim={0.48} />

	<div class="track" class:locked={!opened} bind:this={track} onwheel={onWheel}>
		{#each scenes as scene, index (scene.key)}
			<section
				class="scene"
				id="slide-{index}"
				data-section={scene.kind === 'formal' ? 'hero' : scene.kind}
			>
				{#if scene.kind === 'formal'}
					<div class="formal">
						{#if ctx.introText}<p class="verse">{ctx.introText}</p>{/if}
						{#if ctx.parentsText}<p class="parents">{ctx.parentsText}</p>{/if}
						{#if ctx.welcomeText}<p class="welcome">{ctx.welcomeText}</p>{/if}
						<h2 class="names">{ctx.title}</h2>
						<div class="dateblock">
							<p class="rule-line">
								<span class="hairline"></span><span class="caps">{ctx.dateParts.weekday}</span><span
									class="hairline"
								></span>
							</p>
							<p class="daymonth">{ctx.dateParts.month} {ctx.dateParts.day}</p>
							<p class="rule-line">
								<span class="hairline"></span><span class="caps">{ctx.dateParts.year}</span><span
									class="hairline"
								></span>
							</p>
						</div>
					</div>
				{:else if scene.kind === 'countdown'}
					<Countdown targetIso={data.event.dateMain} lang={ctx.lang} layout="rows" />
				{:else if scene.kind === 'locations'}
					<div class="venues">
						{#each scene.pair as location (location.id)}
							<div class="venue">
								<span class="v-icon"><Icon name={location.kind} /></span>
								<p class="v-kind">{t(ctx.lang, `locations.kind.${location.kind}`)}</p>
								<h3 class="v-name">{locationLabel(location, ctx.lang)}</h3>
								{#if location.startsAt}
									<p class="v-time">{timeFormat.format(new Date(location.startsAt))}</p>
								{/if}
								{#if location.mapsUrl}
									<a
										class="v-maps"
										href={location.mapsUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										{t(ctx.lang, 'locations.open_maps')}
									</a>
								{/if}
							</div>
						{/each}
					</div>
				{:else if scene.kind === 'gifts'}
					<div class="gifts">
						<span class="g-icon"><Icon name="gift" /></span>
						<h2 class="g-heading">{t(ctx.lang, 'gifts.title')}</h2>
						{#if ctx.giftsText}<p class="g-text">{ctx.giftsText}</p>{/if}
						{#if data.theme.giftsAccount}
							<GiftAccount
								label={data.theme.giftsAccountLabel}
								account={data.theme.giftsAccount}
								lang={ctx.lang}
							/>
						{/if}
					</div>
				{:else if scene.kind === 'rsvp'}
					<div class="glass">
						<RsvpBlock {data} {ctx} {currentRsvp} {errorKey} {preview} />
					</div>
				{:else}
					<div class="finale" class:on={active === scenes.length - 1}>
						{#if closingPhoto}
							<figure class="polaroid">
								<img src={closingPhoto} alt="" loading="lazy" />
								<figcaption>{ctx.endCaptionText ?? ctx.closingText}</figcaption>
							</figure>
						{:else}
							<p class="finale-caption">{ctx.endCaptionText ?? ctx.closingText}</p>
						{/if}
						<p class="colophon">einvite</p>
					</div>
				{/if}
			</section>
		{/each}
	</div>

	<!-- cover gate: blurred photo, seal, one button — fades into the deck -->
	<div class="cover" class:gone={opened} aria-hidden={opened}>
		{#if ctx.imageUrls[0]}
			<div class="cover-photo" style="background-image:url('{ctx.imageUrls[0]}')"></div>
		{/if}
		<div class="cover-veil"></div>
		<div class="cover-inner">
			<p class="seal" aria-hidden="true"><span>{ctx.monogram}</span></p>
			<h1 class="cover-names">{ctx.title}</h1>
			<p class="cover-date">{ctx.dateFull}</p>
			<p class="greeting">{t(ctx.lang, 'cover.dear', { name: data.invitation.guestLabel })}</p>
			{#if !opened}
				<button class="open" type="button" onclick={onopen}>{t(ctx.lang, 'cover.open')}</button>
			{/if}
		</div>
	</div>

	{#if opened && !preview}
		<p class="hint" class:done={active === scenes.length - 1} aria-hidden="true">
			<svg
				width="26"
				height="14"
				viewBox="0 0 26 14"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M1 7h22M17 1l6 6-6 6" />
			</svg>
			{t(ctx.lang, 'cover.swipe')}
		</p>
		<button
			class="arrow prev"
			type="button"
			aria-label={t(ctx.lang, 'nav.prev')}
			onclick={() => goTo(active - 1)}
			disabled={active === 0}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M10 2 4 8l6 6" /></svg
			>
		</button>
		<button
			class="arrow next"
			type="button"
			aria-label={t(ctx.lang, 'nav.next')}
			onclick={() => goTo(active + 1)}
			disabled={active === scenes.length - 1}
		>
			<svg
				width="16"
				height="16"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				stroke-width="1.4"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M6 2l6 6-6 6" /></svg
			>
		</button>
		<nav class="dots" aria-label="Scenes">
			{#each scenes as scene, index (scene.key)}
				<button
					type="button"
					class:on={active === index}
					onclick={() => goTo(index)}
					aria-label={scene.key}
					aria-current={active === index}
				></button>
			{/each}
		</nav>
	{/if}
</div>

<noscript>
	<style>
		/* No-JS guests can never fire `onopen`, so the SSR-immediate `.track.locked`
		   lock above would trap them behind the cover forever — this is their only
		   way in. Only `overflow-x` is reset: `height: 100dvh` is the track's own
		   base rule (not something `.locked` adds), and the horizontal scroll-snap
		   layout depends on that box staying viewport-height, so it must not be
		   touched.
		   `!important` is required: Svelte scopes `.track.locked` with its own hash
		   class (e.g. `.track.locked.svelte-abc123`), so a plain `.locked` rule
		   here would lose the specificity fight. */
		.track.locked {
			overflow-x: auto !important;
		}
	</style>
</noscript>

<style>
	/* Photography is the palette (dispatcher re-scopes surfaces to ivory-over-
	   ink for this deck; --ei-accent carries the couple's theme). */
	.stage {
		position: relative;
		height: 100dvh;
		overflow: hidden;
		color: var(--ei-text);
	}

	/* ── the horizontal track ─────────────────────────── */
	.track {
		position: relative;
		z-index: 3;
		display: flex;
		height: 100dvh;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.track.locked {
		overflow: hidden;
	}

	.scene {
		position: relative;
		flex: 0 0 100%;
		width: 100%;
		height: 100dvh;
		display: grid;
		place-items: center;
		padding: 3.2rem 1.9rem 4.6rem;
		scroll-snap-align: center;
		scroll-snap-stop: always;
		/* legibility over the brighter parts of the photo wall */
		text-shadow: 0 1px 14px rgba(10, 8, 6, 0.45);
	}

	/* ── formal invitation scene ──────────────────────── */
	.formal {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.3rem;
		text-align: center;
		max-width: 32rem;
	}

	.verse {
		margin: 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.15rem;
		line-height: 1.9;
		opacity: 0.92;
		white-space: pre-line;
	}

	.parents {
		margin: 0;
		font-family: var(--ei-font-body);
		font-size: 0.84rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		line-height: 2.1;
		white-space: pre-line;
		opacity: 0.92;
	}

	:global([dir='rtl']) .parents {
		letter-spacing: 0;
	}

	.welcome {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.05rem;
		line-height: 1.8;
		opacity: 0.92;
	}

	.names {
		margin: 0.3rem 0 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(2.8rem, 11vw, 4.2rem);
		line-height: 1.25;
		text-wrap: balance;
	}

	.dateblock {
		width: min(19rem, 100%);
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
	}

	.rule-line {
		margin: 0;
		display: flex;
		align-items: center;
		gap: 0.9rem;
	}

	.hairline {
		flex: 1;
		height: 1px;
		background: color-mix(in srgb, currentColor 32%, transparent);
	}

	.caps {
		font-family: var(--ei-font-caps);
		font-size: 0.74rem;
		letter-spacing: 0.32em;
		text-indent: 0.32em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	.daymonth {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: clamp(1.4rem, 5.5vw, 1.8rem);
		letter-spacing: 0.06em;
	}

	:global([dir='rtl']) .caps,
	:global([dir='rtl']) .daymonth {
		letter-spacing: 0;
		text-indent: 0;
	}

	/* the moving swipe caption — chrome, present at the bottom of every scene;
	   it bows out on the finale, where there is nothing left to swipe to */
	.hint {
		position: absolute;
		z-index: 10;
		inset-block-end: 2.7rem;
		inset-inline: 0;
		margin: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.7rem;
		font-family: var(--ei-font-body);
		font-size: 0.68rem;
		letter-spacing: 0.24em;
		text-transform: uppercase;
		color: rgba(250, 246, 238, 0.85);
		text-shadow: 0 1px 10px rgba(10, 8, 6, 0.5);
		pointer-events: none;
		animation: nudge 1.7s ease-in-out infinite;
		transition: opacity 0.5s ease;
	}

	.hint.done {
		opacity: 0;
	}

	:global([dir='rtl']) .hint {
		letter-spacing: 0;
	}

	:global([dir='rtl']) .hint svg {
		transform: scaleX(-1);
	}

	@keyframes nudge {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: 8px 0;
		}
	}

	:global([dir='rtl']) .hint {
		animation-name: nudge-rtl;
	}

	@keyframes nudge-rtl {
		0%,
		100% {
			translate: 0 0;
		}
		50% {
			translate: -8px 0;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.hint {
			animation: none;
		}
	}

	/* ── venue scenes ─────────────────────────────────── */
	.venues {
		display: flex;
		flex-direction: column;
		gap: 2.2rem;
		width: min(26rem, 100%);
	}

	.venue {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.4rem;
		text-align: center;
	}

	.venue + .venue {
		position: relative;
		padding-top: 2.2rem;
	}

	.venue + .venue::before {
		content: '';
		position: absolute;
		top: 0;
		inset-inline: 28%;
		height: 1px;
		background: linear-gradient(
			to right,
			transparent,
			color-mix(in srgb, var(--ei-accent) 55%, transparent),
			transparent
		);
	}

	.v-icon {
		display: grid;
		place-items: center;
		width: 3.6rem;
		height: 3.6rem;
		margin-bottom: 0.5rem;
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		border-radius: 999px;
		color: var(--ei-accent);
	}

	.v-kind {
		margin: 0;
		font-family: var(--ei-font-body);
		font-size: 0.66rem;
		letter-spacing: 0.28em;
		text-indent: 0.28em;
		text-transform: uppercase;
		color: var(--ei-accent);
	}

	.v-name {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 400;
		font-size: 1.5rem;
		line-height: 1.3;
		text-wrap: balance;
	}

	.v-time {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.95rem;
		color: var(--ei-muted);
		font-variant-numeric: tabular-nums;
	}

	.v-maps {
		margin-top: 0.6rem;
		font-family: var(--ei-font-body);
		font-size: 0.68rem;
		letter-spacing: 0.22em;
		text-indent: 0.22em;
		text-transform: uppercase;
		color: inherit;
		text-decoration: none;
		border: 1px solid color-mix(in srgb, currentColor 45%, transparent);
		padding: 0.55rem 1.3rem;
		transition: background-color 0.3s ease;
	}

	.v-maps:hover {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	.v-maps:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	:global([dir='rtl']) .v-kind,
	:global([dir='rtl']) .v-maps {
		letter-spacing: 0;
		text-indent: 0;
	}

	/* ── gifts ────────────────────────────────────────── */
	.gifts {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		text-align: center;
		max-width: 30rem;
	}

	.g-icon {
		display: grid;
		place-items: center;
		width: 3.6rem;
		height: 3.6rem;
		border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
		border-radius: 999px;
		color: var(--ei-accent);
	}

	.g-heading {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.8rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	:global([dir='rtl']) .g-heading {
		letter-spacing: 0;
		text-indent: 0;
	}

	.g-text {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.2rem;
		line-height: 1.85;
		white-space: pre-line;
	}

	/* ── RSVP glass ───────────────────────────────────── */
	.glass {
		width: min(28rem, 100%);
		max-height: calc(100dvh - 7.5rem);
		overflow-y: auto;
		overscroll-behavior: contain;
		/* scrollable, but never shows a scrollbar over the stationery */
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

	/* ── finale: the tilted polaroid slides in ────────── */
	.finale {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.4rem;
		text-align: center;
	}

	.polaroid {
		margin: 0;
		background: #fff;
		padding: 0.85rem 0.85rem 1.2rem;
		box-shadow: 0 22px 60px rgba(8, 6, 4, 0.5);
		max-width: min(19rem, 72vw);
		transform: translateX(120%) rotate(14deg);
		opacity: 0;
		transition:
			transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) 0.35s,
			opacity 0.6s ease 0.35s;
	}

	.finale.on .polaroid {
		transform: rotate(-6deg);
		opacity: 1;
	}

	:global([dir='rtl']) .polaroid {
		transform: translateX(-120%) rotate(-14deg);
	}

	:global([dir='rtl']) .finale.on .polaroid {
		transform: rotate(6deg);
		opacity: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.polaroid,
		:global([dir='rtl']) .polaroid {
			transform: rotate(-6deg);
			opacity: 1;
			transition: none;
		}
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
		text-shadow: none;
	}

	.finale-caption {
		margin: 0;
		font-family: var(--ei-font-script);
		font-size: 1.9rem;
	}

	.colophon {
		margin: 0;
		font-family: var(--ei-font-body);
		font-size: 0.62rem;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: color-mix(in srgb, var(--ei-muted) 70%, transparent);
	}

	/* ── cover gate ───────────────────────────────────── */
	.cover {
		position: absolute;
		inset: 0;
		z-index: 20;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: #14100c;
		text-align: center;
		transition:
			opacity 0.8s cubic-bezier(0.76, 0, 0.24, 1),
			visibility 0s linear 0.8s;
	}

	.cover.gone {
		opacity: 0;
		visibility: hidden;
		pointer-events: none;
	}

	.cover-photo {
		position: absolute;
		inset: -12px;
		background-size: cover;
		background-position: center;
		filter: blur(6px) brightness(0.72);
		transform: scale(1.06);
	}

	.cover-veil {
		position: absolute;
		inset: 0;
		background: linear-gradient(to bottom, rgba(12, 9, 6, 0.35), rgba(12, 9, 6, 0.65));
	}

	.cover-inner {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
		padding: 2rem 1.5rem;
		max-width: 34rem;
	}

	.seal {
		margin: 0 0 0.3rem;
		width: 5rem;
		height: 5rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 75%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		font-size: 1.25rem;
		letter-spacing: 0.08em;
		color: var(--ei-accent);
	}

	.seal span {
		display: grid;
		place-items: center;
		width: 4.2rem;
		height: 4.2rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 40%, transparent);
		border-radius: 999px;
	}

	.cover-names {
		margin: 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(2.9rem, 12vw, 4.4rem);
		line-height: 1.25;
		text-wrap: balance;
	}

	.cover-date {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: 0.88rem;
		letter-spacing: 0.2em;
		text-indent: 0.2em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	:global([dir='rtl']) .cover-date {
		letter-spacing: 0;
		text-indent: 0;
	}

	.greeting {
		margin: 0.3rem 0 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.28rem;
	}

	.open {
		margin-top: 1.6rem;
		font-family: var(--ei-font-body);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: inherit;
		background: transparent;
		border: 1px solid color-mix(in srgb, currentColor 60%, transparent);
		border-radius: 999px;
		padding: 1rem 2.6rem;
		cursor: pointer;
		transition: background-color 0.3s ease;
	}

	.open:hover {
		background: color-mix(in srgb, currentColor 12%, transparent);
	}

	.open:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 3px;
	}

	:global([dir='rtl']) .open {
		letter-spacing: 0;
		text-indent: 0;
	}

	/* ── chrome: dots + arrows ────────────────────────── */
	.dots {
		position: absolute;
		z-index: 10;
		inset-block-end: 1.15rem;
		inset-inline: 0;
		display: flex;
		justify-content: center;
		gap: 0.65rem;
		padding: 0.4rem;
		pointer-events: none;
	}

	.dots button {
		pointer-events: auto;
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

	.arrow {
		display: none;
	}

	@media (hover: hover) and (pointer: fine) and (min-width: 48rem) {
		.arrow {
			position: absolute;
			z-index: 10;
			top: 50%;
			transform: translateY(-50%);
			display: grid;
			place-items: center;
			width: 2.9rem;
			height: 2.9rem;
			border: 1px solid rgba(250, 246, 238, 0.4);
			border-radius: 999px;
			background: rgba(18, 14, 10, 0.35);
			backdrop-filter: blur(6px);
			color: rgba(250, 246, 238, 0.9);
			cursor: pointer;
			transition:
				background-color 0.3s ease,
				opacity 0.3s ease;
		}

		.arrow:hover {
			background: rgba(18, 14, 10, 0.6);
		}

		.arrow:disabled {
			opacity: 0.25;
			cursor: default;
		}

		.arrow:focus-visible {
			outline: 2px solid rgba(250, 246, 238, 0.8);
			outline-offset: 2px;
		}

		.arrow.prev {
			inset-inline-start: 1.1rem;
		}

		.arrow.next {
			inset-inline-end: 1.1rem;
		}

		/* the SVG chevrons point physically; mirror them for RTL reading order */
		:global([dir='rtl']) .arrow svg {
			transform: scaleX(-1);
		}
	}
</style>
