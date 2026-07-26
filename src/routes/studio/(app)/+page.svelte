<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let { data, form } = $props();
	let creating = $state(false);

	const statusColor: Record<string, string> = {
		draft: '#8a857e',
		live: '#3a7d44',
		archived: '#b3423a'
	};
</script>

<svelte:head><title>Events — EInvite Studio</title></svelte:head>

<div class="grid">
	<div class="st-card">
		<h1 class="st-h1">Events</h1>
		<p class="st-sub">Every wedding (or baptism, or birthday) is a row + a theme.</p>

		{#if data.events.length === 0}
			<p>No events yet — create the first one on the right.</p>
		{:else}
			<table class="st-table">
				<thead>
					<tr><th>Event</th><th>Date</th><th>Status</th><th>RSVPs</th><th>Payment</th></tr>
				</thead>
				<tbody>
					{#each data.events as event (event.id)}
						<tr>
							<td>
								<a class="ev-link" href={resolve('/studio/(app)/events/[id]', { id: event.id })}>
									{event.title}
								</a>
								<div class="slug">/{event.slug}</div>
							</td>
							<td>{new Date(event.dateMain).toLocaleDateString()}</td>
							<td
								><span class="dot" style="background:{statusColor[event.status]}"
								></span>{event.status}</td
							>
							<td>
								{event.stats.confirmedSeats} seats ·
								{event.stats.confirmedCards}✓ {event.stats.declinedCards}✗
								{event.stats.pendingCards}…
							</td>
							<td>{event.paymentStatus}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<div class="st-card create">
		<h2 class="st-h1">New event</h2>
		{#if form?.error}<p class="st-error">{form.error}</p>{/if}
		<form
			method="POST"
			action="?/create"
			use:enhance={() => {
				creating = true;
				return async ({ update }) => {
					creating = false;
					await update();
				};
			}}
		>
			<label class="st-field"
				>Link name (kebab-case)
				<input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="elie-and-maya" />
			</label>
			<label class="st-field"
				>Title
				<input name="titleEn" required placeholder="Elie &amp; Maya" />
			</label>
			<details class="translations">
				<summary>Title translations (optional)</summary>
				<label class="st-field"
					>Arabic
					<input name="titleAr" dir="rtl" placeholder="إيلي ومايا" />
				</label>
				<label class="st-field"
					>French
					<input name="titleFr" placeholder="Elie &amp; Maya" />
				</label>
			</details>
			<label class="st-field"
				>Main date &amp; time
				<input name="dateMain" type="datetime-local" required />
			</label>
			<label class="st-field"
				>Type
				<select name="type">
					<option value="wedding">Wedding</option>
					<option value="engagement">Engagement</option>
					<option value="baptism">Baptism</option>
					<option value="birthday">Birthday</option>
					<option value="corporate">Corporate</option>
				</select>
			</label>
			<fieldset class="langs">
				<legend>Languages (first checked = default)</legend>
				<label><input type="checkbox" name="languages" value="ar" checked /> العربية</label>
				<label><input type="checkbox" name="languages" value="fr" checked /> Français</label>
				<label><input type="checkbox" name="languages" value="en" checked /> English</label>
			</fieldset>
			<button class="st-btn" disabled={creating}>{creating ? 'Creating…' : 'Create event'}</button>
		</form>
	</div>
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.25rem;
	}

	@media (min-width: 60rem) {
		.grid {
			grid-template-columns: 1.7fr 1fr;
			align-items: start;
		}
	}

	.ev-link {
		font-weight: 600;
		color: var(--st-accent-dark);
		text-decoration: none;
	}

	.slug {
		color: var(--st-muted);
		font-size: 0.78rem;
	}

	.dot {
		display: inline-block;
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		margin-inline-end: 0.4rem;
	}

	.langs {
		border: 1px solid var(--st-border);
		border-radius: 8px;
		padding: 0.7rem 0.9rem;
		margin: 0 0 1rem;
		display: flex;
		gap: 1rem;
		font-size: 0.9rem;
	}

	.langs legend {
		font-size: 0.78rem;
		font-weight: 600;
		color: var(--st-muted);
		padding-inline: 0.3rem;
	}

	.translations {
		margin: 0 0 1rem;
	}

	.translations summary {
		cursor: pointer;
		font-size: 0.85rem;
		color: var(--st-accent-dark);
		margin-bottom: 0.6rem;
	}
</style>
