<script lang="ts">
	// The envelope front (spec §3.1.1): seal, script names, the engraved date
	// block, the guest's own name, one button. Nothing else competes for
	// attention; no audio has played.
	let {
		title,
		dateParts,
		greeting,
		openLabel,
		monogram,
		opened,
		onopen
	}: {
		title: string;
		dateParts: { weekday: string; day: string; month: string; year: string };
		greeting: string;
		openLabel: string;
		monogram: string;
		opened: boolean;
		onopen: () => void;
	} = $props();
</script>

<section class="slide cover" aria-label={title}>
	<div class="inner">
		<p class="monogram" aria-hidden="true"><span>{monogram}</span></p>
		<h1 class="names">{title}</h1>
		<div class="dateblock">
			<p class="rule-line">
				<span class="hairline"></span><span class="caps">{dateParts.weekday}</span><span
					class="hairline"
				></span>
			</p>
			<p class="daymonth">{dateParts.month} {dateParts.day}</p>
			<p class="rule-line">
				<span class="hairline"></span><span class="caps">{dateParts.year}</span><span
					class="hairline"
				></span>
			</p>
		</div>
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
		gap: 1.4rem;
		padding: 2rem 1.5rem;
		max-width: 34rem;
		width: 100%;
	}

	/* wax-seal ring: two concentric hairlines around the initials */
	.monogram {
		margin: 0 0 0.4rem;
		width: 4.2rem;
		height: 4.2rem;
		display: grid;
		place-items: center;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 70%, transparent);
		border-radius: 999px;
		font-family: var(--ei-font-display);
		font-size: 1.15rem;
		letter-spacing: 0.08em;
		color: var(--ei-accent);
	}

	.monogram span {
		display: grid;
		place-items: center;
		width: 3.5rem;
		height: 3.5rem;
		border: 1px solid color-mix(in srgb, var(--ei-accent) 35%, transparent);
		border-radius: 999px;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(2.9rem, 12vw, 4.4rem);
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
		text-transform: uppercase;
		color: var(--ei-muted);
		text-indent: 0.32em; /* recentre tracked caps between the rules */
	}

	.daymonth {
		margin: 0;
		font-family: var(--ei-font-caps);
		font-size: clamp(1.5rem, 6vw, 1.9rem);
		font-weight: 400;
		letter-spacing: 0.06em;
	}

	.greeting {
		margin: 0.4rem 0 0;
		font-family: var(--ei-font-display);
		font-style: italic;
		font-size: 1.3rem;
	}

	.open {
		margin-top: 1.5rem;
		font-family: var(--ei-font-body);
		font-size: 0.78rem;
		font-weight: 500;
		letter-spacing: 0.3em;
		text-indent: 0.3em;
		text-transform: uppercase;
		color: inherit;
		background: transparent;
		border: 1px solid color-mix(in srgb, currentColor 55%, transparent);
		border-radius: 999px;
		padding: 1rem 2.6rem;
		cursor: pointer;
		transition:
			background-color 0.3s ease,
			transform 0.3s ease;
	}

	.open:hover {
		background: color-mix(in srgb, currentColor 12%, transparent);
		transform: translateY(-2px);
	}

	.open:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 3px;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .caps,
	:global([dir='rtl']) .daymonth,
	:global([dir='rtl']) .open {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
