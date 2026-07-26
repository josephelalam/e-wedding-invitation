<script lang="ts">
	let { data } = $props();
</script>

<svelte:head><title>Activity — EInvite Studio</title></svelte:head>

<div class="st-card">
	<h2 class="st-h1">Activity</h2>
	<p class="st-sub">Who did what, when — including every RSVP submission.</p>

	{#if data.activity.length === 0}
		<p>Nothing yet.</p>
	{:else}
		<table class="st-table">
			<thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr></thead>
			<tbody>
				{#each data.activity as row, index (index)}
					<tr>
						<td>{new Date(row.at).toLocaleString()}</td>
						<td><code class="st-code">{row.actor}</code></td>
						<td>{row.action}</td>
						<td>{row.meta ?? ''}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
