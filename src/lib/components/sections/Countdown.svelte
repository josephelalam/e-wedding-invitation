<script lang="ts">
	import { inview } from '$lib/actions/inview';
	import { t, type Lang } from '$lib/i18n';

	let {
		targetIso,
		lang,
		layout = 'grid'
	}: { targetIso: string; lang: Lang; layout?: 'grid' | 'rows' } = $props();

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
	{:else if layout === 'rows'}
		<!-- engraved ledger rows — the horizontal deck's signature countdown -->
		<div class="rows" role="timer">
			{#each parts as part (part.label)}
				<div class="row">
					<span class="row-label">{part.label}</span>
					<span class="row-value">{String(part.value).padStart(2, '0')}</span>
				</div>
			{/each}
		</div>
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
		max-width: 17rem;
		font-family: var(--ei-font-caps);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.28em;
		text-indent: 0.28em;
		text-transform: uppercase;
		line-height: 2.1;
		color: var(--ei-muted);
	}

	.grid {
		display: flex;
		align-items: flex-start;
	}

	.cell {
		display: flex;
		flex-direction: column;
		gap: 0.55rem;
		min-width: 4.1rem;
		padding-inline: clamp(0.5rem, 2.5vw, 1.1rem);
	}

	.cell + .cell {
		border-inline-start: 1px solid color-mix(in srgb, var(--ei-accent) 30%, transparent);
	}

	.value {
		font-family: var(--ei-font-caps);
		font-weight: 400;
		font-size: clamp(2rem, 7.5vw, 3rem);
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--ei-text);
	}

	.label {
		font-family: var(--ei-font-body);
		font-size: 0.66rem;
		letter-spacing: 0.22em;
		text-indent: 0.22em;
		text-transform: uppercase;
		color: var(--ei-accent);
	}

	.today {
		margin: 0;
		font-family: var(--ei-font-script);
		font-size: 2rem;
		color: var(--ei-accent);
	}

	.rows {
		width: min(19rem, 100%);
		display: flex;
		flex-direction: column;
	}

	.row {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1.5rem;
		padding-block: 0.8rem;
		border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent);
	}

	.row-label {
		font-family: var(--ei-font-body);
		font-size: 0.68rem;
		letter-spacing: 0.28em;
		text-transform: uppercase;
		color: var(--ei-muted);
	}

	.row-value {
		font-family: var(--ei-font-caps);
		font-size: 2.1rem;
		line-height: 1;
		font-variant-numeric: tabular-nums;
	}

	:global([dir='rtl']) .row-label {
		letter-spacing: 0;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .heading,
	:global([dir='rtl']) .label {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
