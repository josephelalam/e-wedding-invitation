<script lang="ts">
	import { inview } from '$lib/actions/inview';

	let { title, welcome, dateFull }: { title: string; welcome: string | null; dateFull: string } =
		$props();
</script>

<div class="content" use:inview>
	<h2 class="names">{title}</h2>
	<p class="flourish" aria-hidden="true">
		<span class="hairline"></span>✦<span class="hairline"></span>
	</p>
	<p class="date">{dateFull}</p>
	{#if welcome}
		<p class="welcome">{welcome}</p>
	{/if}
</div>

<style>
	.content {
		text-align: center;
		max-width: 32rem;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.2rem;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-script);
		font-weight: 400;
		font-size: clamp(2.4rem, 9vw, 3.4rem);
		line-height: 1.3;
		text-wrap: balance;
	}

	.flourish {
		margin: 0;
		width: min(16rem, 70%);
		display: flex;
		align-items: center;
		gap: 0.9rem;
		color: var(--ei-accent);
		font-size: 0.7rem;
	}

	.hairline {
		flex: 1;
		height: 1px;
		background: color-mix(in srgb, var(--ei-accent) 45%, transparent);
	}

	.date {
		margin: 0;
		font-family: var(--ei-font-caps);
		letter-spacing: 0.18em;
		text-indent: 0.18em;
		font-size: 0.92rem;
		color: var(--ei-muted);
		text-transform: uppercase;
	}

	.welcome {
		margin: 0.4rem 0 0;
		font-family: var(--ei-font-display);
		font-size: 1.22rem;
		line-height: 1.75;
	}

	/* Arabic script takes no tracking — letterspacing breaks connected letters */
	:global([dir='rtl']) .date {
		letter-spacing: 0;
		text-indent: 0;
	}
</style>
