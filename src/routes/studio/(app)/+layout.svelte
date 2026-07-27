<script lang="ts">
	import '$lib/styles/studio.css';
	import { authClient } from '$lib/auth-client';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	async function signOut() {
		await authClient.signOut();
		window.location.href = resolve('/studio/login');
	}

	const links = [
		{ href: resolve('/studio'), label: 'Events' },
		{ href: resolve('/studio/outbox'), label: 'Outbox' },
		{ href: resolve('/studio/security'), label: 'Security' }
	];

	const initial = $derived((data.owner.name ?? data.owner.email ?? '?').charAt(0).toUpperCase());
</script>

<div class="shell">
	<header>
		<a class="brand" href={resolve('/studio')}>EInvite<span>Studio</span></a>
		<nav>
			{#each links as link (link.href)}
				<a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
			{/each}
		</nav>
		<div class="who">
			{#if !data.owner.twoFactorEnabled}
				<a class="warn" href={resolve('/studio/security')}>⚠ Enable 2FA</a>
			{/if}
			<span class="chip" title={data.owner.email}>
				<span class="avatar" aria-hidden="true">{initial}</span>
				{data.owner.name}
			</span>
			<button class="st-btn secondary" onclick={signOut}>Sign out</button>
		</div>
	</header>
	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
	}

	header {
		position: sticky;
		top: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		gap: 1.4rem;
		padding: 0.65rem 1.4rem;
		background: rgba(255, 255, 255, 0.86);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		border-bottom: 1px solid var(--st-border);
		flex-wrap: wrap;
	}

	.brand {
		display: inline-flex;
		align-items: baseline;
		gap: 0.5rem;
		font-family: var(--st-font-display);
		font-size: 1.3rem;
		font-weight: 600;
		color: var(--st-text);
		text-decoration: none;
		line-height: 1;
	}

	.brand span {
		font-family: var(--st-font-ui);
		font-size: 0.62rem;
		font-weight: 500;
		letter-spacing: 0.34em;
		text-transform: uppercase;
		color: var(--st-gold);
	}

	nav {
		display: flex;
		gap: 0.3rem;
		flex: 1;
	}

	nav a {
		color: var(--st-muted);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		padding: 0.38rem 0.9rem;
		border-radius: 999px;
		transition:
			background-color 0.18s ease,
			color 0.18s ease;
	}

	nav a:hover {
		color: var(--st-text);
		background: var(--st-surface-2);
	}

	nav a.active {
		color: var(--st-accent-dark);
		background: rgba(184, 150, 110, 0.14);
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
		color: var(--st-muted);
	}

	.who :global(.st-btn) {
		padding: 0.38rem 0.9rem;
		font-size: 0.84rem;
	}

	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		color: var(--st-text);
		font-weight: 500;
	}

	.avatar {
		display: grid;
		place-items: center;
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 999px;
		background: rgba(184, 150, 110, 0.16);
		border: 1px solid rgba(184, 150, 110, 0.4);
		color: var(--st-accent-dark);
		font-family: var(--st-font-display);
		font-size: 0.95rem;
	}

	.warn {
		color: var(--st-danger);
		text-decoration: none;
		font-weight: 500;
		font-size: 0.8rem;
		padding: 0.25rem 0.7rem;
		border: 1px solid #f0d4d1;
		background: #fdf0ef;
		border-radius: 999px;
	}

	main {
		width: min(72rem, 100%);
		margin: 0 auto;
		padding: 1.6rem 1.25rem 3.5rem;
	}
</style>
