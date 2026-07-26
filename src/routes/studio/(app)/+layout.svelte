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
</script>

<div class="shell">
	<header>
		<a class="brand" href={resolve('/studio')}>EInvite <span>Studio</span></a>
		<nav>
			{#each links as link (link.href)}
				<a href={link.href} class:active={page.url.pathname === link.href}>{link.label}</a>
			{/each}
		</nav>
		<div class="who">
			{#if !data.owner.twoFactorEnabled}
				<a class="warn" href={resolve('/studio/security')}>⚠ Enable 2FA</a>
			{/if}
			<span title={data.owner.email}>{data.owner.name}</span>
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
		display: flex;
		align-items: center;
		gap: 1.25rem;
		padding: 0.7rem 1.25rem;
		background: var(--st-surface);
		border-bottom: 1px solid var(--st-border);
		flex-wrap: wrap;
	}

	.brand {
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-size: 0.9rem;
		color: var(--st-accent-dark);
		text-decoration: none;
	}

	.brand span {
		color: var(--st-muted);
		font-weight: 400;
	}

	nav {
		display: flex;
		gap: 0.9rem;
		flex: 1;
	}

	nav a {
		color: var(--st-muted);
		text-decoration: none;
		font-size: 0.9rem;
		padding: 0.25rem 0.1rem;
		border-bottom: 2px solid transparent;
	}

	nav a.active,
	nav a:hover {
		color: var(--st-text);
		border-bottom-color: var(--st-accent);
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.85rem;
		color: var(--st-muted);
	}

	.warn {
		color: var(--st-danger);
		text-decoration: none;
		font-weight: 600;
	}

	main {
		width: min(70rem, 100%);
		margin: 0 auto;
		padding: 1.5rem 1.25rem 3rem;
	}
</style>
