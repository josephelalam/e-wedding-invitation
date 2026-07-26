<script lang="ts">
	// The envelope front (spec §3.1.1): names, date, the guest's own name,
	// one button. Nothing else competes for attention; no audio has played.
	let {
		title,
		dateText,
		greeting,
		openLabel,
		monogram,
		opened,
		onopen
	}: {
		title: string;
		dateText: string;
		greeting: string;
		openLabel: string;
		monogram: string;
		opened: boolean;
		onopen: () => void;
	} = $props();
</script>

<section class="slide cover" aria-label={title}>
	<div class="inner">
		<p class="monogram" aria-hidden="true">{monogram}</p>
		<h1 class="names">{title}</h1>
		<p class="rule" aria-hidden="true">✦</p>
		<p class="date">{dateText}</p>
		<p class="greeting">{greeting}</p>
		{#if !opened}
			<button class="open" type="button" onclick={onopen}>{openLabel}</button>
		{/if}
	</div>
</section>

<style>
	.cover {
		text-align: center;
	}

	.inner {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.1rem;
		padding: 2rem 1.5rem;
		max-width: 34rem;
	}

	.monogram {
		margin: 0 0 0.5rem;
		width: 3.4rem;
		height: 3.4rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 60%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		font-size: 1.05rem;
		letter-spacing: 0.08em;
		color: var(--ei-accent);
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 500;
		font-size: clamp(2.3rem, 9vw, 3.6rem);
		line-height: 1.15;
		text-wrap: balance;
	}

	.rule {
		margin: 0;
		color: var(--ei-accent);
		font-size: 0.8rem;
		letter-spacing: 0.6em;
	}

	.date {
		margin: 0;
		font-size: 1rem;
		letter-spacing: 0.14em;
		color: var(--ei-muted);
	}

	.greeting {
		margin: 0.8rem 0 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.25rem;
		color: var(--ei-text);
	}

	.open {
		margin-top: 1.6rem;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 600;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: var(--ei-bg);
		background: var(--ei-accent);
		border: none;
		border-radius: 999px;
		padding: 0.95rem 2.4rem;
		cursor: pointer;
		transition: transform 0.25s ease;
	}

	.open:hover {
		transform: translateY(-2px);
	}

	.open:focus-visible {
		outline: 2px solid var(--ei-text);
		outline-offset: 3px;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .date,
	:global([dir='rtl']) .open {
		letter-spacing: 0;
	}
</style>
