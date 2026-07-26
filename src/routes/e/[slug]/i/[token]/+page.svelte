<script lang="ts">
	import { page } from '$app/state';
	import InvitationPage from '$lib/components/InvitationPage.svelte';
	import { t, dirFor, type Lang } from '$lib/i18n';
	import type { RsvpView } from '$lib/types';

	let { data, form } = $props();

	const lang = $derived(data.lang as Lang);
</script>

<svelte:head>
	{#if data.invalid}
		<title>{t(lang, 'invalid.title')}</title>
	{:else}
		<title>{data.pageTitle}</title>
		<meta name="robots" content="noindex" />
		<meta property="og:title" content={data.pageTitle} />
		<meta property="og:description" content={data.ogDescription} />
		<meta property="og:type" content="website" />
		{#if data.turnstileSiteKey}
			<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
		{/if}
	{/if}
</svelte:head>

{#if data.invalid}
	<main
		class="invalid-shell"
		dir={dirFor(lang)}
		{lang}
		style="--ei-bg:#faf7f2; --ei-text:#2d2a26; --ei-accent:#a3785f; --ei-muted:#8a857e; --ei-font-display:Georgia, 'Palatino Linotype', 'Noto Naskh Arabic', serif"
	>
		<section class="invalid-slide">
			<div class="invalid-card">
				<p class="invalid-mark" aria-hidden="true">✦</p>
				<h1>{t(lang, 'invalid.title')}</h1>
				<p>{t(lang, 'invalid.body')}</p>
			</div>
		</section>
	</main>
{:else}
	<InvitationPage
		{data}
		token={page.params.token}
		errorKey={form?.errorKey ?? null}
		actionRsvp={(form?.rsvp as RsvpView) ?? null}
	/>
{/if}

<style>
	.invalid-shell {
		background: var(--ei-bg);
		color: var(--ei-text);
		font-family: system-ui, 'Segoe UI', 'Noto Sans Arabic', sans-serif;
	}

	.invalid-slide {
		position: relative;
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 3rem 1.7rem;
	}

	.invalid-slide::before {
		content: '';
		position: absolute;
		inset: 12px;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 55%, transparent);
		pointer-events: none;
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
