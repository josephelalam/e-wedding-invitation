<script lang="ts">
	import '$lib/styles/studio.css';

	let { children } = $props();
</script>

<main class="auth-shell">
	<div class="auth-box">
		<p class="brand">EInvite <span>Studio</span></p>
		{@render children()}
	</div>
</main>

<style>
	.auth-shell {
		min-height: 100dvh;
		display: grid;
		place-items: center;
		padding: 1.5rem;
	}

	.auth-box {
		width: min(26rem, 100%);
	}

	.brand {
		text-align: center;
		font-size: 1.1rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--st-accent-dark);
		font-weight: 700;
	}

	.brand span {
		color: var(--st-muted);
		font-weight: 400;
	}
</style>
