<script lang="ts">
	import { onMount } from 'svelte';
	import AudioPlayer from '$lib/components/AudioPlayer.svelte';
	import { t, dirFor } from '$lib/i18n';
	import { TEMPLATES } from '$lib/templates/registry';
	import { resolveText, mediaUrl, rsvpClosed } from '$lib/templates/context';
	import type { InviteData, TemplateCtx } from '$lib/templates/types';
	import type { RsvpView } from '$lib/types';

	// The dispatcher: shared guest-page plumbing (audio unlock, language
	// switcher, RSVP hydration, localized context) around whichever template
	// module the owner picked (spec §3.1 contract holds for every template).
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
		const byLang = { ar: data.event.titleAr, fr: data.event.titleFr, en: data.event.titleEn };
		return byLang[lang] ?? data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? '';
	});

	const monogram = $derived.by(() => {
		if (data.theme.monogram) return data.theme.monogram;
		const source = data.event.titleEn ?? data.event.titleFr ?? '';
		const initials = source
			.split(/&|\band\b|\bet\b/i)
			.map((part) => part.trim().charAt(0).toUpperCase())
			.filter(Boolean);
		return initials.length >= 2 ? initials.slice(0, 2).join('·') : '✦';
	});

	const ctx: TemplateCtx = $derived({
		lang,
		dir,
		title,
		dateFull: new Intl.DateTimeFormat(lang === 'ar' ? 'ar-LB-u-nu-latn' : lang, {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		}).format(new Date(data.event.dateMain)),
		monogram,
		welcomeText: resolveText(data.theme.texts.welcome, lang),
		closingText: resolveText(data.theme.texts.closing, lang) ?? t(lang, 'closing.default'),
		introText: resolveText(data.theme.texts.intro, lang),
		parentsText: resolveText(data.theme.texts.parents, lang),
		giftsText: resolveText(data.theme.texts.gifts, lang),
		endCaptionText: resolveText(data.theme.texts.endCaption, lang),
		imageUrls: data.theme.images.map(mediaUrl),
		rsvpIsClosed: rsvpClosed(data.theme.rsvpDeadline)
	});

	const Template = $derived((TEMPLATES[data.theme.template] ?? TEMPLATES.slides).component);

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

	<Template {data} {ctx} {currentRsvp} {errorKey} {preview} {opened} onopen={open} />
</main>

<style>
	.invite {
		background: var(--ei-bg);
		color: var(--ei-text);
		font-family: var(--ei-font-body);
		line-height: 1.6;
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

	/* Entrance reveal shared by all templates (class applied only when JS
	   runs — see the inview action; no-JS guests always see content) */
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
</style>
