<script lang="ts">
	import '$lib/styles/studio.css';

	let { data } = $props();
</script>

<svelte:head><title>EInvite — sign in</title></svelte:head>

<main class="shell">
	<div class="box">
		<p class="brand">EInvite</p>
		<div class="st-card center">
			<p class="hello">💍</p>
			<h1 class="st-h1">Your RSVP dashboard</h1>
			<p class="st-sub">لوحة متابعة الردود الخاصة بكم · Votre tableau de bord des réponses</p>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- validated same-origin auth URL -->
			<a class="st-btn go" href={data.target} data-sveltekit-reload>
				Open my dashboard · افتحوا اللوحة · Ouvrir
			</a>
			<p class="note">This button signs you in on this device — the link can be used once.</p>
		</div>
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

	.center {
		text-align: center;
	}

	.hello {
		margin: 0;
		font-size: 2rem;
	}

	.go {
		display: inline-block;
		margin-top: 0.8rem;
		text-decoration: none;
	}

	.note {
		margin: 1rem 0 0;
		font-size: 0.78rem;
		color: var(--st-muted);
	}
</style>
