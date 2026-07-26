<script lang="ts">
	import { onMount } from 'svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import Cover from '$lib/components/sections/Cover.svelte';
	import Hero from '$lib/components/sections/Hero.svelte';
	import Countdown from '$lib/components/sections/Countdown.svelte';
	import Locations from '$lib/components/sections/Locations.svelte';
	import Schedule from '$lib/components/sections/Schedule.svelte';
	import RsvpForm from '$lib/components/sections/RsvpForm.svelte';
	import Closing from '$lib/components/sections/Closing.svelte';
	import { t, dirFor, type Lang } from '$lib/i18n';
	import type { Theme } from '$lib/themes/schema';
	import type { RsvpView, ExtraDate, InviteLocation } from '$lib/types';

	// The whole guest experience (spec §3.1) — shared verbatim between the
	// public token route and the owner's studio preview.
	export type InviteData = {
		lang: Lang;
		languages: string[];
		event: {
			titleEn: string | null;
			titleAr: string | null;
			titleFr: string | null;
			dateMain: string;
			datesExtra: ExtraDate[];
		};
		theme: Theme;
		locations: InviteLocation[];
		invitation: { guestLabel: string; maxSeats: number };
		musicUrl: string | null;
		turnstileSiteKey: string | null;
	};

	let {
		data,
		token = null,
		errorKey = null,
		actionRsvp = null,
		preview = false
	}: {
		data: InviteData;
		token?: string | null;
		errorKey?: string | null;
		actionRsvp?: RsvpView;
		preview?: boolean;
	} = $props();

	const lang = $derived(data.lang);
	const dir = $derived(dirFor(lang));

	let player: ReturnType<typeof AudioPlayer> | undefined = $state();
	let opened = $state(false);
	let fetchedRsvp = $state<RsvpView>(null);

	// Current answer: freshest wins — action result, else the client-side
	// hydration fetch (cached HTML never bakes RSVP state, spec §4.7).
	const currentRsvp = $derived(actionRsvp ?? fetchedRsvp);

	const title = $derived.by(() => {
		const byLang: Record<Lang, string | null> = {
			ar: data.event.titleAr,
			fr: data.event.titleFr,
			en: data.event.titleEn
		};
		return byLang[lang] ?? data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? '';
	});

	const dateFull = $derived(
		new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(data.event.dateMain))
	);

	const monogram = $derived.by(() => {
		if (data.theme.monogram) return data.theme.monogram;
		const source = data.event.titleEn ?? data.event.titleFr ?? '';
		const initials = source
			.split(/&|\band\b|\bet\b/i)
			.map((part) => part.trim().charAt(0).toUpperCase())
			.filter(Boolean);
		return initials.length >= 2 ? initials.slice(0, 2).join('·') : '✦';
	});

	const slides = $derived(
		data.theme.slideOrder.filter((section) => {
			if (section === 'locations') return data.locations.length > 0;
			if (section === 'schedule') return data.event.datesExtra.length > 0;
			return true;
		})
	);

	const welcomeText = $derived(data.theme.texts.welcome?.[lang] ?? null);
	const closingText = $derived(data.theme.texts.closing?.[lang] ?? t(lang, 'closing.default'));

	async function open() {
		opened = true;
		await player?.start();
		document.getElementById('slide-0')?.scrollIntoView({ behavior: 'smooth' });
	}

	onMount(async () => {
		if (!token) return;
		try {
			const res = await fetch(`/api/rsvp/${token}`, { headers: { accept: 'application/json' } });
			if (res.ok) fetchedRsvp = ((await res.json()) as { rsvp: RsvpView }).rsvp;
		} catch {
			// stale cover state is fine — the form still upserts safely
		}
	});
</script>

<main
	class="invite"
	{dir}
	{lang}
	style="--ei-bg:{data.theme.colors.bg}; --ei-text:{data.theme.colors.text}; --ei-accent:{data.theme
		.colors.accent}; --ei-muted:{data.theme.colors.muted}; --ei-font-display:{data.theme.fonts
		.display}; --ei-font-body:{data.theme.fonts.body}"
>
	{#if data.languages.length > 1 && !preview}
		<nav class="langs" aria-label="Language">
			{#each data.languages as code (code)}
				{#if code !== lang}
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
					{#if preview}
						<div class="preview-rsvp">
							<RsvpForm
								maxSeats={data.invitation.maxSeats}
								{lang}
								turnstileSiteKey={null}
								current={null}
								errorKey={null}
							/>
						</div>
					{:else}
						<RsvpForm
							maxSeats={data.invitation.maxSeats}
							{lang}
							turnstileSiteKey={data.turnstileSiteKey}
							current={currentRsvp}
							{errorKey}
						/>
					{/if}
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

	.preview-rsvp {
		pointer-events: none;
		opacity: 0.85;
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
