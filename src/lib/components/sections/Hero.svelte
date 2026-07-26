<script lang="ts">
	import { inview } from '$lib/actions/inview';

	let { title, welcome, dateFull }: { title: string; welcome: string | null; dateFull: string } =
		$props();
</script>

<div class="content" use:inview>
	<h2 class="names">{title}</h2>
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
		gap: 1.1rem;
	}

	.names {
		margin: 0;
		font-family: var(--ei-font-display);
		font-weight: 500;
		font-size: clamp(2rem, 7.5vw, 3rem);
		line-height: 1.18;
		text-wrap: balance;
	}

	.date {
		margin: 0;
		letter-spacing: 0.14em;
		color: var(--ei-accent);
		font-size: 0.95rem;
	}

	.welcome {
		margin: 0.4rem 0 0;
		font-size: 1.06rem;
		line-height: 1.7;
		color: var(--ei-text);
	}
</style>
