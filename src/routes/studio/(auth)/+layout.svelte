<script lang="ts">
	import '$lib/styles/studio.css';

	let { children } = $props();
</script>

<main class="auth-shell">
	<div class="auth-box">
		<p class="brand">EInvite<span>Studio</span></p>
		{@render children()}
	</div>
</main>

<style>
	.auth-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
		background:
			radial-gradient(50rem 30rem at 50% -8rem, rgba(184, 150, 110, 0.14), transparent 65%),
			var(--st-bg);
	}

	.auth-box {
		width: min(26rem, 100%);
	}

	.auth-box :global(.st-card) {
		box-shadow: var(--st-shadow-2);
	}

	.brand {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 0.55rem;
		margin: 0 0 1.1rem;
		font-family: var(--st-font-display);
		font-size: 1.7rem;
		font-weight: 600;
		color: var(--st-text);
	}

	.brand span {
		font-family: var(--st-font-ui);
		font-size: 0.66rem;
		font-weight: 500;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--st-gold);
	}
</style>
