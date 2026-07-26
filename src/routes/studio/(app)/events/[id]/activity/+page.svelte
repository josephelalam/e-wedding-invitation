<script lang="ts">
	let { data } = $props();

	const dateFormat = new Intl.DateTimeFormat('en-GB', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit'
	});
</script>

<svelte:head><title>Activity — EInvite Studio</title></svelte:head>

<div class="st-card">
	<h2 class="st-h1">Activity</h2>
	<p class="st-sub">Who did what, when — including every RSVP submission.</p>

	{#if data.activity.length === 0}
		<p>Nothing yet.</p>
	{:else}
		<ol class="timeline">
			{#each data.activity as row, index (index)}
				<li>
					<span class="icon" aria-hidden="true">{row.icon}</span>
					<div class="body">
						<p class="text">{row.text}</p>
						<p class="meta"><strong>{row.who}</strong> · {dateFormat.format(new Date(row.at))}</p>
					</div>
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.timeline {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.timeline li {
		display: flex;
		gap: 0.8rem;
		padding: 0.65rem 0;
		border-bottom: 1px solid var(--st-border);
	}

	.timeline li:last-child {
		border-bottom: none;
	}

	.icon {
		flex: none;
		width: 1.8rem;
		height: 1.8rem;
		display: grid;
		place-items: center;
		background: #f4f0e9;
		border-radius: 999px;
		font-size: 0.85rem;
	}

	.text {
		margin: 0;
		font-size: 0.93rem;
	}

	.meta {
		margin: 0.1rem 0 0;
		font-size: 0.78rem;
		color: var(--st-muted);
	}
</style>
