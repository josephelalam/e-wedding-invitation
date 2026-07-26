<script lang="ts">
	import { enhance } from '$app/forms';
	import '$lib/styles/studio.css';
	import { t, LANGS, isLang, type Lang } from '$lib/i18n';
	import { page } from '$app/state';

	let { form } = $props();

	const lang = $derived.by((): Lang => {
		const urlLang = page.url.searchParams.get('lang');
		return isLang(urlLang) ? urlLang : 'en';
	});
	let busy = $state(false);
</script>

<svelte:head><title>{t(lang, 'dash.login.title')}</title></svelte:head>

<main class="shell" dir={lang === 'ar' ? 'rtl' : 'ltr'} {lang}>
	<div class="box">
		<p class="brand">EInvite</p>
		<div class="st-card">
			<h1 class="st-h1">{t(lang, 'dash.login.title')}</h1>

			{#if form?.sent}
				<p class="st-success">{t(lang, 'dash.login.sent')}</p>
				<p class="st-sub">{t(lang, 'dash.login.no_email')}</p>
			{:else}
				{#if form?.error === 'rate_limited'}<p class="st-error">
						{t(lang, 'errors.rate_limited')}
					</p>{/if}
				{#if form?.error === 'invalid_email'}<p class="st-error">
						{t(lang, 'errors.generic')}
					</p>{/if}
				<form
					method="POST"
					action="?/send"
					use:enhance={() => {
						busy = true;
						return async ({ update }) => {
							busy = false;
							await update();
						};
					}}
				>
					<label class="st-field"
						>{t(lang, 'dash.login.email')}
						<input name="email" type="email" required autocomplete="email" />
					</label>
					<button class="st-btn" disabled={busy}>{t(lang, 'dash.login.send')}</button>
				</form>
				<p class="st-sub" style="margin-top:1rem">{t(lang, 'dash.login.no_email')}</p>
			{/if}
		</div>
		<nav class="langs" aria-label="Language">
			{#each LANGS as code (code)}
				{#if code !== lang}
					<a href="?lang={code}"
						>{code === 'ar' ? 'العربية' : code === 'fr' ? 'Français' : 'English'}</a
					>
				{/if}
			{/each}
		</nav>
	</div>
</main>

<style>
	.shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.box {
		width: min(26rem, 100%);
	}

	.brand {
		text-align: center;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--st-accent-dark);
		font-weight: 700;
	}

	.langs {
		margin-top: 1rem;
		display: flex;
		justify-content: center;
		gap: 1rem;
	}

	.langs a {
		color: var(--st-muted);
		font-size: 0.85rem;
	}
</style>
