<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { data, children } = $props();

	const id = $derived(data.event.id);
	const tabs = $derived([
		{ href: resolve('/studio/(app)/events/[id]', { id }), label: 'Details' },
		{ href: resolve('/studio/(app)/events/[id]/locations', { id }), label: 'Locations' },
		{ href: resolve('/studio/(app)/events/[id]/theme', { id }), label: 'Theme' },
		{ href: resolve('/studio/(app)/events/[id]/audio', { id }), label: 'Music' },
		{ href: resolve('/studio/(app)/events/[id]/guests', { id }), label: 'Guests' },
		{ href: resolve('/studio/(app)/events/[id]/activity', { id }), label: 'Activity' }
	]);
</script>

<header class="ev-head">
	<div>
		<h1 class="ev-title">
			{data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? data.event.slug}
		</h1>
		<p class="ev-meta">
			<code class="st-code">/{data.event.slug}</code>
			<span>{new Date(data.event.dateMain).toLocaleString()}</span>
			<span class="st-pill {data.event.status}">{data.event.status}</span>
		</p>
	</div>
	<a class="st-btn secondary" href="/e/{data.event.slug}/preview" target="_blank">Open preview ↗</a>
</header>

<nav class="tabs">
	{#each tabs as tab (tab.href)}
		<a href={tab.href} class:active={page.url.pathname === tab.href}>{tab.label}</a>
	{/each}
</nav>

{@render children()}

<style>
	.ev-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		flex-wrap: wrap;
		margin-bottom: 1rem;
	}

	.ev-title {
		font-family: var(--st-font-display);
		font-size: 1.9rem;
		font-weight: 600;
		line-height: 1.15;
		margin: 0 0 0.4rem;
	}

	.ev-meta {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		flex-wrap: wrap;
		margin: 0;
		color: var(--st-muted);
		font-size: 0.88rem;
	}

	.tabs {
		display: flex;
		gap: 0.15rem;
		border-bottom: 1px solid var(--st-border);
		margin-bottom: 1.4rem;
		flex-wrap: wrap;
	}

	.tabs a {
		padding: 0.55rem 1rem;
		color: var(--st-muted);
		text-decoration: none;
		font-size: 0.9rem;
		font-weight: 500;
		border-bottom: 2px solid transparent;
		border-radius: var(--st-radius-sm) var(--st-radius-sm) 0 0;
		margin-bottom: -1px;
		transition:
			color 0.18s ease,
			background-color 0.18s ease,
			border-color 0.18s ease;
	}

	.tabs a:hover {
		color: var(--st-text);
		background: var(--st-surface-2);
	}

	.tabs a.active {
		color: var(--st-accent-dark);
		border-bottom-color: var(--st-gold);
	}
</style>
