<script lang="ts">
	import { enhance } from '$app/forms';

	let { data } = $props();
</script>

<svelte:head><title>Outbox — EInvite Studio</title></svelte:head>

<div class="st-card">
	<h1 class="st-h1">Outbox</h1>
	<p class="st-sub">
		Sign-in links waiting to be delivered. No email service is configured on the $0 tier — copy a
		link and send it over WhatsApp, then mark it done.
	</p>

	{#if data.links.length === 0}
		<p>Nothing pending. 🎉</p>
	{:else}
		<table class="st-table">
			<thead><tr><th>For</th><th>Link</th><th>Created</th><th></th></tr></thead>
			<tbody>
				{#each data.links as link (link.id)}
					<tr>
						<td>{link.recipient}</td>
						<td><code class="st-code">{link.url}</code></td>
						<td>{new Date(link.createdAt).toLocaleString()}</td>
						<td>
							<form method="POST" action="?/consume" use:enhance>
								<input type="hidden" name="id" value={link.id} />
								<button class="st-btn secondary">Done</button>
							</form>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>
