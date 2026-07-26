<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import { t, type Lang } from '$lib/i18n';

	let { targetIso, lang }: { targetIso: string; lang: Lang } = $props();

	const target = $derived(new Date(targetIso).getTime());
	let now = $state(Date.now());

	$effect(() => {
		const interval = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(interval);
	});

	const remaining = $derived(Math.max(0, target - now));
	const parts = $derived.by(() => {
		const totalSec = Math.floor(remaining / 1000);
		return [
			{ value: Math.floor(totalSec / 86400), label: t(lang, 'countdown.days') },
			{ value: Math.floor((totalSec % 86400) / 3600), label: t(lang, 'countdown.hours') },
			{ value: Math.floor((totalSec % 3600) / 60), label: t(lang, 'countdown.minutes') },
			{ value: totalSec % 60, label: t(lang, 'countdown.seconds') }
		];
	});
</script>

<div class="content" use:inview>
	<h2 class="heading">{t(lang, 'countdown.title')}</h2>
	{#if remaining === 0}
		<p class="today">{t(lang, 'countdown.today')}</p>
	{:else}
		<div class="grid" role="timer">
			{#each parts as part (part.label)}
				<div class="cell">
					<span class="value">{part.value}</span>
					<span class="label">{part.label}</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.content {
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 1.8rem;
		align-items: center;
	}

	.heading {
		margin: 0;
		font-size: 0.9rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		color: var(--ei-muted);
	}

	.grid {
		display: flex;
		gap: clamp(0.8rem, 4vw, 1.6rem);
	}

	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		min-width: 3.6rem;
	}

	.value {
		font-family: var(--ei-font-display);
		font-size: clamp(2.2rem, 8vw, 3.2rem);
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--ei-text);
	}

	.label {
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		color: var(--ei-accent);
	}

	.today {
		margin: 0;
		font-family: var(--ei-font-display);
		font-size: 1.7rem;
		color: var(--ei-accent);
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .heading {
		letter-spacing: 0;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .label {
		letter-spacing: 0;
	}
</style>
