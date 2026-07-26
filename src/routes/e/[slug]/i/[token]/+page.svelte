<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import Cover from '$lib/components/sections/Cover.svelte';
	import Hero from '$lib/components/sections/Hero.svelte';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import RsvpForm from '$lib/components/sections/RsvpForm.svelte';
	import Closing from '$lib/components/sections/Closing.svelte';
	import { t, dirFor, type Lang } from '$lib/i18n';
	import type { RsvpView } from '$lib/types';

	let { data, form } = $props();

	const lang = $derived(data.lang as Lang);
	const dir = $derived(dirFor(lang));

	let player: ReturnType<typeof AudioPlayer> | undefined = $state();
	let opened = $state(false);
	let fetchedRsvp = $state<RsvpView>(null);

	// Current answer: freshest wins — action result, else the client-side
	// hydration fetch (cached HTML never bakes RSVP state, spec §4.7).
	const currentRsvp = $derived((form?.rsvp as RsvpView) ?? fetchedRsvp);

	function localizedTitle(): string {
		if (data.invalid) return '';
		const byLang: Record<Lang, string | null> = {
			ar: data.event.titleAr,
			fr: data.event.titleFr,
			en: data.event.titleEn
		};
		return byLang[lang] ?? data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? '';
	}

	const title = $derived(localizedTitle());

	const dateFull = $derived(
		data.invalid
			? ''
			: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
					weekday: 'long',
					day: 'numeric',
					month: 'long',
					year: 'numeric'
				}).format(new Date(data.event.dateMain))
	);

	function deriveMonogram(): string {
		if (data.invalid) return '✦';
		if (data.theme.monogram) return data.theme.monogram;
		const source = data.event.titleEn ?? data.event.titleFr ?? '';
		const initials = source
			.split(/&|\band\b|\bet\b/i)
			.map((part) => part.trim().charAt(0).toUpperCase())
			.filter(Boolean);
		return initials.length >= 2 ? initials.slice(0, 2).join('·') : '✦';
	}

	const monogram = $derived(deriveMonogram());

	const slides = $derived(
		data.invalid
			? []
			: data.theme.slideOrder.filter((section) => {
					if (section === 'locations') return data.locations.length > 0;
					if (section === 'schedule') return data.event.datesExtra.length > 0;
					return true;
				})
	);

	const welcomeText = $derived(data.invalid ? null : (data.theme.texts.welcome?.[lang] ?? null));
	const closingText = $derived(
		data.invalid ? '' : (data.theme.texts.closing?.[lang] ?? t(lang, 'closing.default'))
	);

	async function open() {
		opened = true;
		await player?.start();
		document.getElementById('slide-0')?.scrollIntoView({ behavior: 'smooth' });
	}

	onMount(async () => {
		if (data.invalid) return;
		try {
			const res = await fetch(`/api/rsvp/${page.params.token}`, {
				headers: { accept: 'application/json' }
			});
			if (res.ok) fetchedRsvp = ((await res.json()) as { rsvp: RsvpView }).rsvp;
		} catch {
			// stale cover state is fine — the form still upserts safely
		}
	});
</script>

<svelte:head>
	{#if data.invalid}
		<title>{t(lang, 'invalid.title')}</title>
	{:else}
		<title>{title}</title>
		<meta name="robots" content="noindex" />
		<meta property="og:title" content={title} />
		<meta property="og:description" content={dateFull} />
		<meta property="og:type" content="website" />
		{#if data.turnstileSiteKey}
			<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
		{/if}
	{/if}
</svelte:head>

{#if data.invalid}
	<main
		class="invite invalid-shell"
		dir={dirFor(data.lang as Lang)}
		lang={data.lang}
		style="--ei-bg:#faf7f2; --ei-text:#2d2a26; --ei-accent:#a3785f; --ei-muted:#8a857e; --ei-font-display:Georgia, 'Palatino Linotype', 'Noto Naskh Arabic', serif; --ei-font-body:system-ui, 'Segoe UI', 'Noto Sans Arabic', sans-serif"
	>
		<section class="slide">
			<div class="invalid-card">
				<p class="invalid-mark" aria-hidden="true">✦</p>
				<h1>{t(lang, 'invalid.title')}</h1>
				<p>{t(lang, 'invalid.body')}</p>
			</div>
		</section>
	</main>
{:else}
	<main
		class="invite"
		{dir}
		{lang}
		style="--ei-bg:{data.theme.colors.bg}; --ei-text:{data.theme.colors.text}; --ei-accent:{data
			.theme.colors.accent}; --ei-muted:{data.theme.colors.muted}; --ei-font-display:{data.theme
			.fonts.display}; --ei-font-body:{data.theme.fonts.body}"
	>
		{#if data.languages.length > 1}
			<nav class="langs" aria-label="Language">
				{#each data.languages as code (code)}
					{#if code !== lang}
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- same-route query-string language switch -->
						<a href="?lang={code}" data-sveltekit-reload>{code === 'ar' ? 'ع' : code}</a>
					{/if}
				{/each}
			</nav>
		{/if}

		<AudioPlayer
			bind:this={player}
			src={data.musicUrl}
			muteLabel={t(lang, 'audio.mute')}
			unmuteLabel={t(lang, 'audio.unmute')}
		/>

		<div class="scroller" class:locked={!opened}>
			<Cover
				{title}
				dateText={dateFull}
				greeting={t(lang, 'cover.dear', { name: data.invitation.guestLabel })}
				openLabel={t(lang, 'cover.open')}
				{monogram}
				{opened}
				onopen={open}
			/>

			{#each slides as section, index (section)}
				<section class="slide" id="slide-{index}" data-section={section}>
					{#if section === 'hero'}
						<Hero {title} welcome={welcomeText} {dateFull} />
					{:else if section === 'countdown'}
						<Countdown targetIso={data.event.dateMain} {lang} />
					{:else if section === 'locations'}
						<Locations locations={data.locations} {lang} />
					{:else if section === 'schedule'}
						<Schedule datesExtra={data.event.datesExtra} {lang} />
					{:else if section === 'rsvp'}
						<RsvpForm
							maxSeats={data.invitation.maxSeats}
							{lang}
							turnstileSiteKey={data.turnstileSiteKey}
							current={currentRsvp}
							errorKey={form?.errorKey ?? null}
						/>
					{:else if section === 'closing'}
						<Closing text={closingText} {monogram} />
					{/if}
					{#if index === 0 && opened}
						<div class="more" aria-hidden="true">⌄</div>
					{/if}
				</section>
			{/each}
		</div>
	</main>
{/if}

<style>
	.invite {
		background: var(--ei-bg);
		color: var(--ei-text);
		font-family: var(--ei-font-body);
		line-height: 1.6;
	}

	.scroller {
		height: 100dvh;
		overflow-y: auto;
		scroll-snap-type: y mandatory;
		overscroll-behavior-y: contain;
	}

	.scroller.locked {
		overflow: hidden;
	}

	/* Every slide carries the card frame — the invitation's recurring signature. */
	.invite :global(.slide) {
		position: relative;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 3.2rem 1.7rem;
		scroll-snap-align: start;
		scroll-snap-stop: always;
	}

	.invite :global(.slide)::before {
		content: '';
		position: absolute;
		inset: 12px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 55%, transparent);
		pointer-events: none;
	}

	.invite :global(.slide)::after {
		content: '';
		position: absolute;
		inset: 17px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 22%, transparent);
		pointer-events: none;
	}

	/* Entrance reveal (class applied only when JS runs — see inview action) */
	.invite :global(.reveal) {
		opacity: 0;
		transform: translateY(16px);
		transition:
			opacity 0.7s ease,
			transform 0.7s ease;
	}

	.invite :global(.reveal.in-view) {
		opacity: 1;
		transform: none;
	}

	.langs {
		position: fixed;
		z-index: 30;
		inset-block-start: 1.4rem;
		inset-inline-end: 1.6rem;
		display: flex;
		gap: 0.7rem;
	}

	.langs a {
		color: var(--ei-muted);
		text-decoration: none;
		font-size: 0.78rem;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		border-bottom: 1px solid color-mix(in srgb, var(--ei-muted) 40%, transparent);
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

	.invalid-card {
		text-align: center;
		max-width: 26rem;
		display: flex;
		flex-direction: column;
		gap: 0.8rem;
	}

	.invalid-card h1 {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 500;
		font-size: 1.7rem;
	}

	.invalid-card p {
		margin: 0;
		color: var(--ei-muted);
	}

	.invalid-mark {
		color: var(--ei-accent);
		letter-spacing: 0.5em;
	}
</style>
