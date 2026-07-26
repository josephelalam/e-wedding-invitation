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
		<h1 class="st-h1">
			{data.event.titleEn ?? data.event.titleFr ?? data.event.titleAr ?? data.event.slug}
		</h1>
		<p class="st-sub">
			/{data.event.slug} · {new Date(data.event.dateMain).toLocaleString()} ·
			<strong>{data.event.status}</strong>
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
		margin-bottom: 0.8rem;
	}

	.tabs {
		display: flex;
		gap: 0.2rem;
		border-bottom: 1px solid var(--st-border);
		margin-bottom: 1.25rem;
		flex-wrap: wrap;
	}

	.tabs a {
		padding: 0.5rem 0.9rem;
		color: var(--st-muted);
		text-decoration: none;
		font-size: 0.9rem;
		border-bottom: 2px solid transparent;
		margin-bottom: -1px;
	}

	.tabs a.active,
	.tabs a:hover {
		color: var(--st-text);
		border-bottom-color: var(--st-accent);
	}
</style>
